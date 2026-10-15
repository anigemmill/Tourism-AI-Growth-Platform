"use server";

// Self-service account actions: forgotten password, reset, invitation
// acceptance, email verification, password change and session management.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser, clearSessionCookie } from "@/lib/auth/session";
import { usableBusinessFor } from "@/lib/auth/core";
import {
  acceptInvite, changeOwnPassword, requestPasswordReset, resetPasswordWithToken, sendAccountLink, verifyEmailWithToken,
} from "@/lib/auth/flows";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { emailConfigured } from "@/lib/email";
import type { ActionState } from "@/lib/forms";

const MIN = 60_000;

async function limited(scope: string, max: number, windowMs: number, id?: string) {
  const ip = clientIp(await headers());
  const r = await checkRateLimit(`${scope}:${id ?? ip}`, windowMs, max);
  return !r.allowed;
}

const TOO_MANY = { error: "Too many attempts. Please wait a few minutes and try again." };

// ---------------------------------------------------------------------------
// Public (signed out)
// ---------------------------------------------------------------------------

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = z.email().safeParse(String(fd.get("email") ?? "").trim());
  if (!email.success) return { error: "Enter a valid email." };
  if (await limited("forgot-ip", 10, 15 * MIN)) return TOO_MANY;
  // Without an email provider no link can be delivered; say so rather than
  // claiming one was sent (this reveals nothing about which accounts exist).
  if (!emailConfigured()) return { error: "Password reset by email isn't available yet. Please contact your programme lead." };
  // Per-address limit stops someone flooding a person's inbox; it fails
  // silently so it can't be used to discover whether an account exists.
  const perEmail = await checkRateLimit(`forgot-email:${email.data.toLowerCase()}`, 60 * MIN, 3);
  if (perEmail.allowed) await requestPasswordReset(email.data);
  return { ok: "If an account exists for that email, we've sent a link to reset the password. It expires in 1 hour." };
}

const newPassword = z
  .object({ token: z.string().min(1).max(200), password: z.string().max(500), confirm: z.string().max(500) })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

function fieldError(issues: z.core.$ZodIssue[]): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const i of issues) (fieldErrors[String(i.path[0] ?? "form")] ??= []).push(i.message);
  return { error: issues[0].message, fieldErrors };
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = newPassword.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldError(parsed.error.issues);
  if (await limited("token-ip", 20, 15 * MIN)) return TOO_MANY;
  const r = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!r.ok) return { error: r.error, fieldErrors: { password: [r.error] } };
  redirect("/login?reset=done");
}

export async function acceptInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = newPassword.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldError(parsed.error.issues);
  if (await limited("token-ip", 20, 15 * MIN)) return TOO_MANY;
  const name = String(fd.get("name") ?? "").slice(0, 120);
  const r = await acceptInvite(parsed.data.token, parsed.data.password, name);
  if (!r.ok) return { error: r.error };
  redirect("/login?invite=done");
}

export async function confirmEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("token-ip", 20, 15 * MIN)) return TOO_MANY;
  const r = await verifyEmailWithToken(String(fd.get("token") ?? ""));
  if (!r.ok) return { error: r.error };
  return { ok: "Email address confirmed. Thank you." };
}

// ---------------------------------------------------------------------------
// Signed in
// ---------------------------------------------------------------------------

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ current: z.string().min(1, "Enter your current password.").max(500), password: z.string().max(500), confirm: z.string().max(500) })
    .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldError(parsed.error.issues);
  if (await limited("change-password", 10, 15 * MIN, user.id)) return TOO_MANY;
  const r = await changeOwnPassword(user.id, parsed.data.current, parsed.data.password, user.sessionId);
  if (!r.ok) return { error: r.error };
  revalidatePath("/account");
  revalidatePath("/portal/account");
  return { ok: "Password changed. You've been signed out on your other devices." };
}

export async function sendVerificationEmail(): Promise<ActionState> {
  const user = await requireUser();
  if (await limited("verify-send", 3, 60 * MIN, user.id)) return TOO_MANY;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  if (u.emailVerifiedAt) return { ok: "Your email is already confirmed." };
  const d = await sendAccountLink(user.id, "EMAIL_VERIFY", { actorId: user.id });
  return d.emailed ? { ok: `We've sent a confirmation link to ${user.email}.` } : { error: "Email isn't configured yet, so we couldn't send the link." };
}

export async function revokeMySession(sessionId: string): Promise<ActionState> {
  const user = await requireUser();
  // Scoped to the signed-in user: another user's session id matches nothing.
  const r = await prisma.authSession.deleteMany({ where: { id: sessionId, userId: user.id } });
  if (r.count) await audit(user.id, "session.revoke", "user", user.id, "Signed out one of own sessions");
  if (sessionId === user.sessionId) {
    await clearSessionCookie();
    redirect("/login");
  }
  revalidatePath("/account");
  revalidatePath("/portal/account");
  return { ok: r.count ? "Signed out." : "That session had already ended." };
}

export async function revokeOtherSessions(): Promise<ActionState> {
  const user = await requireUser();
  const r = await prisma.authSession.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
  await audit(user.id, "session.revoke_others", "user", user.id, `Signed out ${r.count} other session(s)`);
  revalidatePath("/account");
  revalidatePath("/portal/account");
  return { ok: `Signed out ${r.count} other session(s).` };
}

/** Operators linked to several businesses choose which one they work in. */
export async function switchBusiness(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "OPERATOR") return { error: "Only operator accounts switch business." };
  const target = String(fd.get("operatorId") ?? "");
  // Only an active business the user is a member of can be selected.
  const allowed = await usableBusinessFor(user.id, target);
  if (allowed !== target) return { error: "You don't have access to that business." };
  await prisma.user.update({ where: { id: user.id }, data: { operatorId: target } });
  await audit(user.id, "user.switch_business", "operator", target, "Switched current business");
  redirect("/portal");
}
