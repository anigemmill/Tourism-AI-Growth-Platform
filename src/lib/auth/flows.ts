// Account flows: invitations, password reset, email verification and
// password change. No Next.js request APIs here, so integration tests call
// these directly. Server actions add rate limiting, cookies and redirects.
//
// Rules: passwords are only ever set by their owner (through an emailed,
// single-use, time-limited link or with their current password); nobody can
// read, retrieve or choose another user's password. Every change is audited.

import { prisma } from "@/lib/prisma";
import type { AuthTokenPurpose } from "@/generated/prisma";
import { audit } from "@/lib/audit";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { getBrand } from "@/lib/brand";
import { consumeToken, issueToken, revokeTokens, TOKEN_TTL_MS } from "./account-tokens";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { revokeUserSessions } from "./core";

export const MAX_PASSWORD_LENGTH = 200;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (/^(.)\1+$/.test(pw)) return "Choose a less predictable password.";
  return null;
}

const PATHS: Record<AuthTokenPurpose, string> = {
  INVITE: "/invite",
  PASSWORD_RESET: "/reset-password",
  EMAIL_VERIFY: "/verify-email",
};

function linkFor(purpose: AuthTokenPurpose, token: string) {
  return `${appUrl()}${PATHS[purpose]}?token=${encodeURIComponent(token)}`;
}

function hours(purpose: AuthTokenPurpose) {
  const h = TOKEN_TTL_MS[purpose] / 3_600_000;
  return h >= 48 ? `${h / 24} days` : h === 1 ? "1 hour" : `${h} hours`;
}

function emailFor(purpose: AuthTokenPurpose, name: string, link: string, invitedBy?: string) {
  const greeting = `Kia ora ${name},`;
  const brand = getBrand();
  const product = brand.product;
  const signature = brand.id === "findable" ? "— Findable" : "— Outside In · Tourism AI Growth OS";
  const footer = `\n\nThis link works once and expires in ${hours(purpose)}. If you weren't expecting this email you can ignore it.\n\n${signature}`;
  switch (purpose) {
    case "INVITE":
      return {
        subject: `You're invited to ${product}`,
        text: `${greeting}\n\n${invitedBy ? `${invitedBy} has invited you` : "You've been invited"} to ${product}. Set your password to activate your account:\n\n${link}${footer}`,
      };
    case "PASSWORD_RESET":
      return {
        subject: `Reset your ${product} password`,
        text: `${greeting}\n\nWe received a request to reset your password. Choose a new one here:\n\n${link}${footer}`,
      };
    case "EMAIL_VERIFY":
      return {
        subject: "Confirm your email address",
        text: `${greeting}\n\nConfirm this is your email address for ${product}:\n\n${link}${footer}`,
      };
  }
}

export interface Delivery {
  emailed: boolean;
  /**
   * Only when email is not configured and the caller is allowed to hand the
   * link over in person (a super admin). Shown once; never stored or logged.
   */
  manualLink?: string;
}

/** Issues a token for `purpose` and emails the link to the user. */
export async function sendAccountLink(
  userId: string,
  purpose: AuthTokenPurpose,
  opts: { actorId: string | null; actorName?: string; allowManualLink?: boolean }
): Promise<Delivery> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
  const { token } = await issueToken(userId, purpose, opts.actorId);
  const link = linkFor(purpose, token);
  const res = await sendEmail({ to: user.email, ...emailFor(purpose, user.name, link, opts.actorName) });
  if (res.sent) return { emailed: true };
  if (opts.allowManualLink && !emailConfigured()) return { emailed: false, manualLink: link };
  return { emailed: false };
}

// ---------------------------------------------------------------------------
// Self-service password reset
// ---------------------------------------------------------------------------

/**
 * Starts a reset for this email if it belongs to an active account. Always
 * resolves the same way so the response never reveals whether an account
 * exists; the caller shows one generic message.
 */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true, passwordHash: true } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) return;
  await sendAccountLink(user.id, "PASSWORD_RESET", { actorId: null });
  await audit(user.id, "password.reset_requested", "user", user.id, "Password reset link requested (self-service)");
}

export type FlowResult = { ok: true; userId: string } | { ok: false; error: string };

const INVALID_LINK = "This link is invalid or has expired. Request a new one.";

export async function resetPasswordWithToken(token: string, password: string): Promise<FlowResult> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    const id = await consumeToken(token, "PASSWORD_RESET", tx);
    if (!id) return null;
    const u = await tx.user.findUnique({ where: { id }, select: { status: true, emailVerifiedAt: true } });
    if (!u || u.status !== "ACTIVE") return null;
    await tx.user.update({
      where: { id },
      // Following an emailed link proves control of the address.
      data: { passwordHash, passwordChangedAt: new Date(), emailVerifiedAt: u.emailVerifiedAt ?? new Date() },
    });
    await revokeTokens(id, "PASSWORD_RESET", tx);
    return id;
  });
  if (!userId) return { ok: false, error: INVALID_LINK };
  const n = await revokeUserSessions(userId);
  await audit(userId, "password.reset", "user", userId, `Password reset via emailed link; ${n} session(s) signed out`);
  return { ok: true, userId };
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function acceptInvite(token: string, password: string, name?: string): Promise<FlowResult> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    const id = await consumeToken(token, "INVITE", tx);
    if (!id) return null;
    const u = await tx.user.findUnique({ where: { id }, select: { status: true } });
    if (!u || u.status !== "PENDING") return null;
    await tx.user.update({
      where: { id },
      data: {
        passwordHash, status: "ACTIVE", emailVerifiedAt: new Date(), passwordChangedAt: new Date(),
        ...(name?.trim() ? { name: name.trim().slice(0, 120) } : {}),
      },
    });
    return id;
  });
  if (!userId) return { ok: false, error: "This invitation is invalid, has expired or has been revoked. Ask for a new one." };
  await audit(userId, "user.invite_accepted", "user", userId, "Invitation accepted; account activated");
  return { ok: true, userId };
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function verifyEmailWithToken(token: string): Promise<FlowResult> {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) return { ok: false, error: INVALID_LINK };
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit(userId, "user.email_verified", "user", userId, "Email address verified");
  return { ok: true, userId };
}

// ---------------------------------------------------------------------------
// Change own password
// ---------------------------------------------------------------------------

export async function changeOwnPassword(
  userId: string,
  current: string,
  next: string,
  keepSessionId: string
): Promise<FlowResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, status: true } });
  if (!user?.passwordHash || user.status !== "ACTIVE") return { ok: false, error: "Your account cannot change its password." };
  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false, error: "Your current password is incorrect." };
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  if (current === next) return { ok: false, error: "Choose a password you haven't used here before." };
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
  await revokeTokens(userId, "PASSWORD_RESET");
  const n = await revokeUserSessions(userId, keepSessionId);
  await audit(userId, "password.change", "user", userId, `Changed own password; ${n} other session(s) signed out`);
  return { ok: true, userId };
}
