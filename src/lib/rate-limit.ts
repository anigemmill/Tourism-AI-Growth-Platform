// Sliding-window rate limiting backed by Postgres (RateLimitHit).
// Deliberately simple for pilot scale — no external cache/queue dependency.
// Each check does one count query and, if allowed, one insert; callers pick
// a `key` that scopes the window (e.g. "login-ip:<ip>", "ai-discovery:<userId>").

import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export async function checkRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) {
    return { allowed: false, retryAfterMs: windowMs };
  }
  await prisma.rateLimitHit.create({ data: { key } });
  return { allowed: true, retryAfterMs: 0 };
}

// Best-effort client IP extraction behind Vercel's proxy. Not spoof-proof
// (x-forwarded-for is client-influenceable outside Vercel's edge), but
// sufficient to blunt casual brute-force sprays for a pilot deployment.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
