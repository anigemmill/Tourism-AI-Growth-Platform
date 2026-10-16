// Support view: a Super Admin sees a client's portal exactly as the client
// does, and may make supported changes on the client's behalf while an
// explicit, time-limited edit grant is active.
//
// Rules (enforced here, on the server, for every read and every change):
//  - Only Super Admins (role FOUNDER) may use the support view.
//  - Reads use an operator-scoped actor for the chosen business, so the view
//    shows the same records the client sees (never INTERNAL records, never
//    another business's data).
//  - A change needs an active SupportEditGrant row for this admin, this
//    sign-in session and this business, not expired and not revoked, plus the
//    admin's existing permission for that change. The audit log records what
//    happened; it is never used as proof of authorisation.
//  - Team actions only target operator users linked to this business.
//
// No Next.js request APIs here, so integration tests call these directly.

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { UserRole } from "@/generated/prisma";
import type { Actor } from "@/lib/authz";
import { audit, diff } from "@/lib/audit";
import { f } from "@/lib/forms";
import { OPERATOR_CATEGORIES } from "@/lib/labels";
import { resendInvite, sendPasswordReset, setUserStatus, type AdminResult } from "@/lib/admin/users";

export const SUPPORT_EDIT_TTL_MS = 30 * 60_000;
const VIEW_AUDIT_INTERVAL_MS = 5 * 60_000;

/** The signed-in Super Admin, as resolved from a valid session. */
export interface SupportAdmin {
  id: string;
  name: string;
  role: UserRole;
  sessionId: string;
  permissions: readonly string[];
}

export class SupportAccessError extends Error {}

export function isSupportAdmin(user: { role: UserRole }): boolean {
  return user.role === "FOUNDER";
}

function assertSupportAdmin(user: { role: UserRole }) {
  if (!isSupportAdmin(user)) throw new SupportAccessError("Only Super Admins can use the client view.");
}

function need(admin: SupportAdmin, permission: string) {
  if (!admin.permissions.includes(permission)) throw new SupportAccessError("You don't have permission to do that.");
}

const ID = /^[a-z0-9]{10,40}$/i;

/** The business being viewed, or null if the id is malformed or unknown. */
export async function supportBusiness(operatorId: string) {
  if (!ID.test(operatorId)) return null;
  return prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, name: true, category: true, cohort: true, accountStatus: true },
  });
}

/**
 * Read-only actor for the client view: exactly what this business's own
 * operator sees through the portal data layer (tenant-scoped, no INTERNAL
 * records). Only ever built for a verified Super Admin.
 */
export function clientViewActor(admin: SupportAdmin, operatorId: string): Actor {
  assertSupportAdmin(admin);
  return { id: admin.id, role: "OPERATOR", operatorId };
}

// ---------------------------------------------------------------------------
// Edit grants
// ---------------------------------------------------------------------------

/** The active grant for this admin + session + business, if any. */
export async function activeEditGrant(admin: SupportAdmin, operatorId: string, now = new Date()) {
  if (!isSupportAdmin(admin)) return null;
  return prisma.supportEditGrant.findFirst({
    where: { userId: admin.id, sessionId: admin.sessionId, operatorId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });
}

/**
 * Turns on edit mode for one business in the current session. Any other
 * active grant held by this session (e.g. for another business) is revoked,
 * so a session edits at most one business at a time.
 */
export async function enterEditMode(admin: SupportAdmin, operatorId: string, now = new Date()) {
  assertSupportAdmin(admin);
  const business = await supportBusiness(operatorId);
  if (!business) throw new SupportAccessError("That business doesn't exist.");
  // The session must still exist (a stale or revoked session cannot get a grant).
  const session = await prisma.authSession.findFirst({ where: { id: admin.sessionId, userId: admin.id, expiresAt: { gt: now } }, select: { id: true } });
  if (!session) throw new SupportAccessError("Your session has ended. Sign in again.");
  const expiresAt = new Date(now.getTime() + SUPPORT_EDIT_TTL_MS);
  const grant = await prisma.$transaction(async (tx) => {
    await tx.supportEditGrant.updateMany({ where: { sessionId: admin.sessionId, revokedAt: null }, data: { revokedAt: now } });
    return tx.supportEditGrant.create({ data: { userId: admin.id, sessionId: admin.sessionId, operatorId, expiresAt } });
  });
  await audit(admin.id, "support.edit_start", "operator", operatorId, `Entered edit mode for ${business.name} (client view)`, {
    grantId: grant.id, expiresAt: expiresAt.toISOString(),
  });
  return grant;
}

/** Turns edit mode off for this business in the current session. */
export async function leaveEditMode(admin: SupportAdmin, operatorId: string, reason: "left" | "exit" = "left", now = new Date()) {
  assertSupportAdmin(admin);
  const r = await prisma.supportEditGrant.updateMany({
    where: { userId: admin.id, sessionId: admin.sessionId, operatorId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now },
  });
  if (r.count > 0) {
    const business = await supportBusiness(operatorId);
    await audit(admin.id, "support.edit_end", "operator", operatorId, `Left edit mode for ${business?.name ?? "business"} (${reason === "exit" ? "exited client view" : "turned off"})`);
  }
  return r.count;
}

async function requireEditGrant(admin: SupportAdmin, operatorId: string) {
  const grant = await activeEditGrant(admin, operatorId);
  if (!grant) throw new SupportAccessError("Edit mode is off or has expired. Turn on edit mode to make changes.");
  return grant;
}

// ---------------------------------------------------------------------------
// Audit of viewing
// ---------------------------------------------------------------------------

/** Records that the admin viewed a client page (at most once per page per 5 minutes). */
export async function recordView(admin: SupportAdmin, operatorId: string, page: string, now = new Date()) {
  assertSupportAdmin(admin);
  const recent = await prisma.auditLog.findFirst({
    where: {
      actorId: admin.id, action: "support.view", entityType: "operator", entityId: operatorId,
      createdAt: { gt: new Date(now.getTime() - VIEW_AUDIT_INTERVAL_MS) },
      changes: { path: ["page"], equals: page },
    },
    select: { id: true },
  });
  if (recent) return false;
  const business = await supportBusiness(operatorId);
  await audit(admin.id, "support.view", "operator", operatorId, `Viewed ${business?.name ?? "business"} as client: ${page}`, { page });
  return true;
}

// ---------------------------------------------------------------------------
// Changes on the client's behalf
// ---------------------------------------------------------------------------

/** The business details the client sees on Account & team → Business. */
export const businessDetailsSchema = z.object({
  name: f.str().pipe(z.string().max(200)),
  category: z.enum(OPERATOR_CATEGORIES as [string, ...string[]]),
  websiteUrl: f.url(),
  bookingUrl: f.url(),
  contactName: f.optStr().pipe(z.string().max(200).optional()),
  contactEmail: f.email(),
  contactPhone: f.optStr().pipe(z.string().max(60).optional()),
});
export type BusinessDetails = z.infer<typeof businessDetailsSchema>;

export type SupportResult = { ok: true; message: string; link?: string } | { ok: false; error: string };

async function run(fn: () => Promise<SupportResult>): Promise<SupportResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof SupportAccessError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function updateBusinessDetails(admin: SupportAdmin, operatorId: string, input: BusinessDetails): Promise<SupportResult> {
  return run(async () => {
    assertSupportAdmin(admin);
    need(admin, "operators.edit");
    const grant = await requireEditGrant(admin, operatorId);
    const data = businessDetailsSchema.parse(input);
    const before = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId } });
    const values = {
      name: data.name, category: data.category,
      websiteUrl: data.websiteUrl ?? null, bookingUrl: data.bookingUrl ?? null,
      contactName: data.contactName ?? null, contactEmail: data.contactEmail ?? null, contactPhone: data.contactPhone ?? null,
    };
    await prisma.operator.update({ where: { id: operatorId }, data: values });
    await audit(admin.id, "update", "operator", operatorId, `Updated business details for ${values.name} on behalf of the client (client view)`, {
      onBehalfOf: operatorId, grantId: grant.id, changes: diff(before, values),
    });
    return { ok: true, message: "Business details saved." };
  });
}

export const TEAM_ACTIONS = ["resend_invite", "password_reset", "suspend", "reactivate"] as const;
export type TeamAction = (typeof TEAM_ACTIONS)[number];

const TEAM_ACTION_LABELS: Record<TeamAction, string> = {
  resend_invite: "Resent invitation",
  password_reset: "Sent password reset link",
  suspend: "Suspended user",
  reactivate: "Reactivated user",
};

/** Existing user-management actions, limited to this business's operator users. */
export async function teamAction(admin: SupportAdmin, operatorId: string, userId: string, action: TeamAction): Promise<SupportResult> {
  return run(async () => {
    assertSupportAdmin(admin);
    if (!TEAM_ACTIONS.includes(action)) throw new SupportAccessError("Unknown action.");
    need(admin, "users.manage");
    const grant = await requireEditGrant(admin, operatorId);
    const link = await prisma.userBusiness.findUnique({
      where: { userId_operatorId: { userId, operatorId } },
      select: { user: { select: { email: true, role: true } } },
    });
    if (!link || link.user.role !== "OPERATOR") throw new SupportAccessError("That person isn't on this business's team.");

    const r: AdminResult =
      action === "resend_invite" ? await resendInvite(admin, userId)
      : action === "password_reset" ? await sendPasswordReset(admin, userId)
      : await setUserStatus(admin, userId, action === "suspend" ? "SUSPENDED" : "ACTIVE");
    if (!r.ok) return r;
    await audit(admin.id, "support.team_action", "operator", operatorId, `${TEAM_ACTION_LABELS[action]} (${link.user.email}) on behalf of the client (client view)`, {
      onBehalfOf: operatorId, grantId: grant.id, userId, action,
    });
    return { ok: true, message: r.message, link: r.delivery?.manualLink };
  });
}
