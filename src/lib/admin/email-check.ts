// Super-admin email check: shows how account email is set up and sends one
// test message to the admin's own address, so delivery can be verified
// without involving anyone else and without reading any secret.

import { audit } from "@/lib/audit";
import { getBrand } from "@/lib/brand";
import { appUrl, appUrlProblem, EMAIL_FAILURE_HELP, emailConfigured, sendEmail, senderDomain } from "@/lib/email";
import type { AdminResult } from "./users";

export interface EmailStatus {
  configured: boolean;
  /** EMAIL_FROM as set (an address, not a secret), or null. */
  sender: string | null;
  senderDomain: string | null;
  /** Where invitation and password-reset links point. */
  linkBase: string;
  linkProblem: string | null;
}

export function emailStatus(env: Record<string, string | undefined> = process.env): EmailStatus {
  return {
    configured: emailConfigured(env),
    sender: env.EMAIL_FROM?.trim() || null,
    senderDomain: senderDomain(env),
    linkBase: appUrl(env),
    linkProblem: appUrlProblem(env),
  };
}

/** Sends a link-free test email to the super admin's own address. */
export async function sendTestEmail(actor: { id: string; email: string; role: string }): Promise<AdminResult> {
  if (actor.role !== "FOUNDER") return { ok: false, error: "Only a super admin can run the email check." };
  if (!emailConfigured()) return { ok: false, error: "Email isn't configured: set RESEND_API_KEY and EMAIL_FROM for this environment in Vercel, then redeploy." };
  const product = getBrand().product;
  const res = await sendEmail({
    to: actor.email,
    subject: `${product} email check`,
    text: `This is a test from ${product}'s email check. It contains no link and needs no action.\n\nIf you can read this, account emails (invitations and password resets) can reach this inbox.`,
  });
  const outcome = res.sent ? "accepted" : res.reason === "failed" ? res.failure : res.reason;
  await audit(actor.id, "email.test", "user", actor.id, `Email check: ${outcome}`, { outcome, status: res.sent ? 200 : res.reason === "failed" ? res.status ?? null : null });
  if (res.sent) return { ok: true, message: `Resend accepted the test email to ${actor.email}. Check that inbox (and spam); delivery is confirmed only once it arrives.` };
  if (res.reason === "not-configured") return { ok: false, error: "Email isn't configured." };
  const code = res.providerError ? ` (Resend: ${res.providerError}${res.status ? `, HTTP ${res.status}` : ""})` : res.status ? ` (HTTP ${res.status})` : "";
  return { ok: false, error: `Not sent${code}. ${EMAIL_FAILURE_HELP[res.failure]}` };
}
