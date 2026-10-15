// Authentication logic that does not touch Next.js request APIs, so it can
// be exercised directly by tests. Cookie handling lives in ./session.ts.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma";
import { effectivePermissions, type Permission } from "@/lib/rbac/permissions";
import { verifyPassword } from "./password";
import { hashToken, newSessionToken, SESSION_TTL_DAYS } from "./tokens";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** OPERATOR: the business currently in use (always one of their memberships). */
  operatorId: string | null;
  permissions: Permission[];
  sessionId: string;
}

/** How often a session's lastSeenAt is refreshed (avoids a write per request). */
const LAST_SEEN_RESOLUTION_MS = 5 * 60_000;

const LOCKOUT_WINDOW_MIN = 15;
const LOCKOUT_MAX_FAILURES = 8;

// No password hashes to this value — it exists only so the "user not found"
// path pays the same scrypt cost as a real verification, closing a timing
// side-channel that would otherwise let an attacker enumerate valid emails.
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$mO2pzXAENfOxSKOicaL1Bg==$AWCdQBqk6l5/gFvq/kNPa86zq53Uy2wdwXJ3jDXm86821q5JJGVTDDhUBIDQHb+Dizu+/vjOLbKBDsKtJGNBNw==";

export type LoginResult =
  | { ok: true; user: AuthUser; token: string; expiresAt: Date }
  | { ok: false; error: string };

export async function attemptLogin(
  emailRaw: string,
  password: string,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MIN * 60_000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: since } },
  });
  if (recentFailures >= LOCKOUT_MAX_FAILURES) {
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${LOCKOUT_WINDOW_MIN} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a scrypt verification, even for a nonexistent/inactive user,
  // so response time doesn't reveal whether the email is registered.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  const valid = Boolean(user && user.status === "ACTIVE" && user.passwordHash && passwordOk);

  // Operators need an active business they belong to. Only checked (and
  // reported) once the password is known to be right, so it reveals nothing
  // to someone guessing.
  let operatorId = user?.operatorId ?? null;
  if (user && valid && user.role === "OPERATOR") {
    operatorId = await usableBusinessFor(user.id, user.operatorId);
    if (!operatorId) {
      await prisma.loginAttempt.create({ data: { email, success: false } });
      return { ok: false, error: "Your business account is not active. Contact the programme team." };
    }
  }

  await prisma.loginAttempt.create({ data: { email, success: valid } });

  if (!user || !valid) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const session = await prisma.authSession.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null, ipAddress: ipAddress ?? null },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), operatorId } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "login", entityType: "user", entityId: user.id, summary: "Signed in" },
  });

  return {
    ok: true,
    token,
    expiresAt,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, operatorId,
      permissions: await permissionsFor(user.id, user.role), sessionId: session.id,
    },
  };
}

/**
 * The business an operator user may work in: their current one if they are
 * still a member and it is active, otherwise their first active membership.
 */
export async function usableBusinessFor(userId: string, preferred: string | null): Promise<string | null> {
  const memberships = await prisma.userBusiness.findMany({
    where: { userId, operator: { accountStatus: "ACTIVE" } },
    select: { operatorId: true },
    orderBy: { createdAt: "asc" },
  });
  if (preferred && memberships.some((m) => m.operatorId === preferred)) return preferred;
  return memberships[0]?.operatorId ?? null;
}

export async function permissionsFor(userId: string, role: UserRole): Promise<Permission[]> {
  if (role === "FOUNDER") return effectivePermissions(role);
  const [roleOverrides, userOverrides] = await Promise.all([
    prisma.rolePermission.findMany({ where: { role }, select: { permission: true, granted: true } }),
    prisma.userPermission.findMany({ where: { userId }, select: { permission: true, granted: true } }),
  ]);
  return effectivePermissions(role, roleOverrides, userOverrides);
}

export async function userForToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const u = session.user;
  let operatorId: string | null = null;
  if (u.role === "OPERATOR") {
    // Re-checked on every request: removing a membership or suspending the
    // business takes effect immediately, and a stale or tampered current
    // business can never be used.
    operatorId = await usableBusinessFor(u.id, u.operatorId);
    if (!operatorId) return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, operatorId,
    permissions: await permissionsFor(u.id, u.role), sessionId: session.id,
  };
}

export async function revokeToken(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Signs a user out everywhere (optionally keeping one session). Returns the count. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const r = await prisma.authSession.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return r.count;
}
