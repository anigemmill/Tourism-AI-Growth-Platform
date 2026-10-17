// Transactional email via Resend's HTTP API (no SDK dependency).
//
// Configure in Vercel → Settings → Environment Variables:
//   RESEND_API_KEY  — API key from resend.com (sensitive)
//   EMAIL_FROM      — verified sender, e.g. "Outside In <no-reply@theoutsidein.nz>"
//   APP_URL         — public base URL for links, e.g. https://app.theoutsidein.nz
//                     (required in production: see appUrlProblem)
//
// Without RESEND_API_KEY nothing is sent: in development the message is
// written to the server console (and kept in memory for tests); in
// production sendEmail reports { sent: false } so callers can say so.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Why the provider refused or didn't answer. Derived from Resend's documented
 * error `name` and status, never from the key or the message body.
 */
export type EmailFailure =
  | "api_key" // key missing, invalid, revoked or without sending permission
  | "testing_mode" // no verified domain yet: Resend only delivers to the account owner
  | "sender_not_verified" // EMAIL_FROM's domain isn't verified in Resend
  | "invalid_sender" // EMAIL_FROM isn't a valid address
  | "rate_limited" // rate limit or daily/monthly quota
  | "rejected" // any other refusal (e.g. invalid recipient)
  | "unavailable"; // network error, timeout or provider outage

export type SendResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" }
  | { sent: false; reason: "failed"; failure: EmailFailure; status?: number; providerError?: string };

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
      const { name, message } = await resendError(res);
      const failure = classifyResendError(res.status, name, message);
      // Never log the email body (it can contain a single-use link), the
      // recipient, the key or the provider's message (it can quote addresses).
      console.error(`email send failed: HTTP ${res.status} resend=${name ?? "unknown"} failure=${failure} from-domain=${senderDomain() ?? "unknown"}`);
      return { sent: false, reason: "failed", failure, status: res.status, providerError: name };
    }
    return { sent: true };
  } catch (err) {
    console.error("email send failed:", (err as Error).name);
    return { sent: false, reason: "failed", failure: "unavailable" };
  }
}

async function resendError(res: Response): Promise<{ name?: string; message?: string }> {
  try {
    const body = (await res.json()) as { name?: unknown; message?: unknown };
    return {
      name: typeof body.name === "string" ? body.name.replace(/[^a-z_]/gi, "").slice(0, 60) : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch {
    return {};
  }
}

/** Maps a Resend error response to a cause someone can act on. */
export function classifyResendError(status: number, name?: string, message = ""): EmailFailure {
  if (name === "missing_api_key" || name === "invalid_api_key" || name === "restricted_api_key") return "api_key";
  if (/testing emails|your own email address/i.test(message)) return "testing_mode";
  if (/domain is not verified|not verified/i.test(message)) return "sender_not_verified";
  if (name === "invalid_from_address") return "invalid_sender";
  if (status === 429 || /rate_limit|quota/.test(name ?? "")) return "rate_limited";
  if (status === 401) return "api_key";
  if (status >= 500) return "unavailable";
  return "rejected";
}

/** What to do about each failure, for the admin email check. */
export const EMAIL_FAILURE_HELP: Record<EmailFailure, string> = {
  api_key: "Resend rejected the API key. Create a new key in Resend (API Keys → Create, permission \"Sending access\", domain: your verified domain), replace RESEND_API_KEY in Vercel (Production), then redeploy.",
  testing_mode: "The Resend account has no verified sending domain, so it only delivers to the account owner's own address. Verify the domain in Resend → Domains and use an address on it in EMAIL_FROM.",
  sender_not_verified: "The domain in EMAIL_FROM isn't verified in Resend. Finish verification in Resend → Domains (DNS records at your DNS host), or change EMAIL_FROM to an address on a verified domain.",
  invalid_sender: "EMAIL_FROM isn't a valid sender. Use the form Findable <no-reply@your-verified-domain>.",
  rate_limited: "Resend's rate limit or quota was reached. Wait and retry; check the plan's daily and monthly limits in Resend.",
  rejected: "Resend refused this message. Check the recipient address and Resend → Logs for the details.",
  unavailable: "Resend couldn't be reached or timed out. Retry shortly; check status.resend.com.",
};

/** The domain part of EMAIL_FROM (not secret: it appears on every email sent). */
export function senderDomain(env: Record<string, string | undefined> = process.env): string | null {
  const from = env.EMAIL_FROM?.trim();
  if (!from) return null;
  const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = addr.split("@")[1]?.trim().toLowerCase();
  return domain && /^[a-z0-9.-]+$/.test(domain) ? domain : null;
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

/**
 * Why account links can't be sent safely, or null. In production the link
 * base must be set explicitly: Vercel's fallback is the shortest production
 * domain, which may be a domain that serves a different site, so a
 * single-use token would land on the wrong host.
 */
export function appUrlProblem(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.APP_URL?.trim();
  if (!explicit) {
    return env.VERCEL_ENV === "production"
      ? "APP_URL isn't set, so account links can't be addressed safely. Set APP_URL (e.g. https://app.theoutsidein.nz) for Production in Vercel and redeploy."
      : null;
  }
  let url: URL;
  try {
    url = new URL(explicit);
  } catch {
    return "APP_URL isn't a valid URL.";
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) return "APP_URL must start with https://.";
  if (url.pathname.replace(/\/+$/, "") !== "" || url.search || url.hash) return "APP_URL must be the site's base address only, e.g. https://app.theoutsidein.nz.";
  return null;
}
