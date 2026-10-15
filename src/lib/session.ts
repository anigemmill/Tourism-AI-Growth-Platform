// Compatibility adapter for the destination-intelligence modules
// (docs/ARCHITECTURE.md §6), which filter by the legacy Role enum.
//
// The original dev-only cookie role switcher has been removed: the legacy
// role is now derived from the authenticated Growth OS user (src/lib/auth).
// Staff who may import data / run connectors (destination.manage) map to
// ADMIN, other staff with destination.view to PARTNER-level read access
// (canManage false), operators to BUSINESS, anyone else PUBLIC.

import type { Role } from "@/generated/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export interface Session {
  role: Role;
  businessId: string | null;
  email: string | null;
  /** May import data, run connectors and review AI discovery checks. */
  canManage: boolean;
}

export async function getSession(): Promise<Session> {
  const user = await getCurrentUser();
  if (!user) return { role: "PUBLIC", businessId: null, email: null, canManage: false };
  if (user.role === "OPERATOR") {
    return { role: "BUSINESS", businessId: user.operatorId, email: user.email, canManage: false };
  }
  if (user.permissions.includes("destination.manage")) return { role: "ADMIN", businessId: null, email: user.email, canManage: true };
  if (user.permissions.includes("destination.view")) return { role: "PARTNER", businessId: null, email: user.email, canManage: false };
  return { role: "PUBLIC", businessId: null, email: user.email, canManage: false };
}
