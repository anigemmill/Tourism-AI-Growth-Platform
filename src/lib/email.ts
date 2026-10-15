// Transactional email via Resend's HTTP API (no SDK dependency).
//
// Configure in Vercel → Settings → Environment Variables:
//   RESEND_API_KEY  — API key from resend.com (sensitive)
//   EMAIL_FROM      — verified sender, e.g. "Outside In <no-reply@theoutsidein.nz>"
//   APP_URL         — public base URL for links, e.g. https://tourism-ai-growth-platform.vercel.app
//
// Without RESEND_API_KEY nothing is sent: in development the message is
// written to the server console (and kept in memory for tests); in
// production sendEmail reports { sent: false } so callers can say so.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type SendResult = { sent: true } | { sent: false; reason: "not-configured" | "failed" };

/** Messages "sent" while no provider is configured outside production. */
export const devOutbox: EmailMessage[] = [];

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      devOutbox.push(msg);
      if (devOutbox.length > 50) devOutbox.shift();
      if (process.env.EMAIL_DEV_LOG !== "off") console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    }
    return { sent: false, reason: "not-configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Never log the message body: it can contain a single-use link.
      console.error(`email send failed: HTTP ${res.status}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("email send failed:", (err as Error).name);
    return { sent: false, reason: "failed" };
  }
}

/**
 * Base URL for links in emails. Deliberately never derived from the request's
 * Host header, which a client can influence (reset-link poisoning).
 */
export function appUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
