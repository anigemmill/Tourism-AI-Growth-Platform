"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { guarded } from "@/lib/actions";
import { confirmed, NOT_CONFIRMED, parseForm, type ActionState } from "@/lib/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import * as admin from "@/lib/admin/users";

const ROLES = ["FOUNDER", "ADMIN", "PROGRAMME_MANAGER", "ANALYST", "OPERATOR"] as const;

function done(r: admin.AdminResult, ...paths: string[]): ActionState {
  for (const p of paths) revalidatePath(p);
  if (!r.ok) return { error: r.error };
  return { ok: r.message, link: r.delivery?.manualLink };
}

const userPath = (id: string) => `/admin/users/${id}`;

export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = parseForm(
    z.object({
      name: z.string().trim().min(1, "Required").max(120),
      email: z.email({ error: "Enter a valid email" }).max(254),
      role: z.enum(ROLES),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  const businessIds = fd.getAll("businessIds").map(String).filter(Boolean).slice(0, 50);
  if (parsed.data.role === "FOUNDER" && !confirmed(fd)) return { error: "Tick the confirmation box to invite a super admin." };
  const limit = await checkRateLimit(`invite:${actor.id}`, 60 * 60_000, 50);
  if (!limit.allowed) return { error: "Invitation limit reached. Try again in an hour." };
  return guarded(async () => done(await admin.inviteUser(actor, { ...parsed.data, businessIds }), "/admin/users", "/admin"));
}

export async function resendInvite(userId: string): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  return guarded(async () => done(await admin.resendInvite(actor, userId), userPath(userId)));
}

export async function revokeInvite(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.revokeInvite(actor, userId), userPath(userId), "/admin/users"));
}

export async function setStatus(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const status = z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).safeParse(fd.get("status"));
  if (!status.success) return { error: "Choose a status." };
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.setUserStatus(actor, userId, status.data), userPath(userId), "/admin/users", "/admin"));
}

export async function changeRole(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.roles");
  const role = z.enum(ROLES).safeParse(fd.get("role"));
  if (!role.success) return { error: "Choose a role." };
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.changeRole(actor, userId, role.data), userPath(userId), "/admin/users"));
}

export async function sendReset(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.sendPasswordReset(actor, userId), userPath(userId)));
}

export async function revokeSessions(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.revokeSessionsFor(actor, userId), userPath(userId)));
}

export async function rename(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const name = z.string().trim().min(1, "Enter a name.").max(120).safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  return guarded(async () => done(await admin.updateProfile(actor, userId, name.data), userPath(userId)));
}

export async function linkBusiness(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const operatorId = String(fd.get("operatorId") ?? "");
  if (!operatorId) return { error: "Choose a business." };
  return guarded(async () => done(await admin.linkBusiness(actor, userId, operatorId, fd.get("isPrimaryContact") === "on"), userPath(userId), `/admin/businesses/${operatorId}`));
}

export async function unlinkBusiness(userId: string, operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await admin.unlinkBusiness(actor, userId, operatorId), userPath(userId), `/admin/businesses/${operatorId}`));
}

export async function setUserPermission(userId: string, permission: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.roles");
  const v = String(fd.get("value") ?? "");
  const granted = v === "grant" ? true : v === "deny" ? false : null;
  return guarded(async () => done(await admin.setUserPermission(actor, userId, permission, granted), userPath(userId)));
}
