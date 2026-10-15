// Single-use, time-limited tokens for invitations, password resets and
// email verification. The raw token exists only in the emailed link; the
// database stores its SHA-256 hash, so a database leak cannot be replayed.

import { prisma } from "@/lib/prisma";
import type { AuthTokenPurpose, Prisma } from "@/generated/prisma";
import { hashToken, newSessionToken } from "./tokens";

export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  INVITE: 7 * 86_400_000,
  PASSWORD_RESET: 60 * 60_000,
  EMAIL_VERIFY: 2 * 86_400_000,
};

type Db = Prisma.TransactionClient | typeof prisma;

/** Issues a new token, revoking any earlier unused one for the same purpose. */
export async function issueToken(
  userId: string,
  purpose: AuthTokenPurpose,
  createdById: string | null,
  db: Db = prisma
): Promise<{ token: string; expiresAt: Date }> {
  await revokeTokens(userId, purpose, db);
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);
  await db.authToken.create({ data: { userId, purpose, tokenHash: hashToken(token), createdById, expiresAt } });
  return { token, expiresAt };
}

export async function revokeTokens(userId: string, purpose: AuthTokenPurpose | AuthTokenPurpose[], db: Db = prisma): Promise<number> {
  const r = await db.authToken.updateMany({
    where: { userId, purpose: { in: Array.isArray(purpose) ? purpose : [purpose] }, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count;
}

/** Looks a token up without using it (to render the right page). */
export async function peekToken(raw: string | undefined | null, purpose: AuthTokenPurpose) {
  if (!raw || raw.length > 200) return null;
  const t = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, name: true, status: true } } },
  });
  if (!t || t.purpose !== purpose || t.usedAt || t.revokedAt || t.expiresAt < new Date()) return null;
  return t;
}

/**
 * Atomically marks a valid token used and returns its user id, or null if it
 * is unknown, the wrong kind, expired, revoked or already used. Two
 * concurrent submissions of the same token cannot both succeed.
 */
export async function consumeToken(raw: string, purpose: AuthTokenPurpose, db: Db = prisma): Promise<string | null> {
  if (!raw || raw.length > 200) return null;
  const tokenHash = hashToken(raw);
  const now = new Date();
  const r = await db.authToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (r.count !== 1) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return t?.userId ?? null;
}
