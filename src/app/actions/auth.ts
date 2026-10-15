"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin, revokeToken } from "@/lib/auth/core";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/tokens";
import type { ActionState } from "@/lib/forms";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Looser than core.ts's per-email lockout (8/15min) — this blocks a single
// source spraying many different emails, which the per-email check alone
// does not catch.
const LOGIN_IP_WINDOW_MS = 15 * 60_000;
const LOGIN_IP_MAX_ATTEMPTS = 30;

const schema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, "Enter your password.").max(500),
  next: z.string().optional(),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const ip = clientIp(h);
  const ipLimit = await checkRateLimit(`login-ip:${ip}`, LOGIN_IP_WINDOW_MS, LOGIN_IP_MAX_ATTEMPTS);
  if (!ipLimit.allowed) {
    return { error: "Too many sign-in attempts from this network. Try again later." };
  }

  const ua = h.get("user-agent");
  const result = await attemptLogin(parsed.data.email, parsed.data.password, ua, ip);
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.token, result.expiresAt);
  // Only allow same-site relative redirects.
  const next = parsed.data.next;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(result.user.role === "OPERATOR" ? "/portal" : safeNext ?? "/");
}

export async function logout() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeToken(token);
  await clearSessionCookie();
  redirect("/login");
}
