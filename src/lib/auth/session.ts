import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission, isStaffUser, type Permission } from "@/lib/rbac/permissions";
import { userForToken, type AuthUser } from "./core";
import { SESSION_COOKIE } from "./tokens";

export type { AuthUser };

/** Current user for this request, memoised per render pass. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return userForToken(store.get(SESSION_COOKIE)?.value);
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Staff role with at least one staff permission (may use the staff app). */
export function isStaff(user: AuthUser): boolean {
  return isStaffUser(user);
}

export function can(user: AuthUser, p: Permission): boolean {
  return hasPermission(user, p);
}

/** Programme staff only. Operators are sent to their portal. */
export async function requireStaff(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isStaff(user)) redirect(user.role === "OPERATOR" ? "/portal" : "/no-access");
  return user;
}

/**
 * Requires an explicit permission (src/lib/rbac/permissions.ts). Use in every
 * page, server action and route handler that reads or changes protected data.
 */
export async function requirePermission(p: Permission): Promise<AuthUser> {
  const user = await requireUser();
  if (!can(user, p)) redirect(user.role === "OPERATOR" ? "/portal" : "/no-access");
  return user;
}

/** Super admin only. */
export async function requireFounder(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "FOUNDER") redirect(user.role === "OPERATOR" ? "/portal" : "/no-access");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
