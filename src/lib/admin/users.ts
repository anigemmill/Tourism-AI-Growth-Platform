// User administration. Every function re-checks the actor's permissions
// itself (pages and actions check too — defence in depth), audits the
// change, and never handles a plaintext password.

import { prisma } from "@/lib/prisma";
import { Prisma, type UserRole, type UserStatus } from "@/generated/prisma";
import { audit } from "@/lib/audit";
import { revokeUserSessions } from "@/lib/auth/core";
import { revokeTokens } from "@/lib/auth/account-tokens";
import { sendAccountLink, type Delivery } from "@/lib/auth/flows";
import {
  ALL_PERMISSIONS, assignable, assignableRoles, effectivePermissions, isPermission, PERMISSIONS, ROLE_DEFAULTS, type Permission,
} from "@/lib/rbac/permissions";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";

export interface AdminActor {
  id: string;
  name: string;
  role: UserRole;
  permissions: readonly string[];
}

export type AdminResult = { ok: true; message: string; delivery?: Delivery; userId?: string } | { ok: false; error: string };

export class AdminError extends Error {}

function need(actor: AdminActor, p: Permission) {
  if (!actor.permissions.includes(p)) throw new AdminError("You don't have permission to do that.");
}

/** Only super admins may act on super admin accounts. */
function guardTarget(actor: AdminActor, target: { role: UserRole }) {
  if (target.role === "FOUNDER" && actor.role !== "FOUNDER") throw new AdminError("Only a super admin can change a super admin account.");
}

async function wrap(fn: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AdminError) return { ok: false, error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return { ok: false, error: "That record no longer exists." };
    throw err;
  }
}

/**
 * Runs `fn` in a SERIALIZABLE transaction, retrying on serialization
 * conflicts, so concurrent changes cannot together remove the last
 * active super admin.
 */
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2034" && attempt < 3) continue;
      throw err;
    }
  }
}

/** Throws if no other active super admin would remain after `userId` loses it. */
async function assertAnotherSuperAdmin(tx: Prisma.TransactionClient, userId: string) {
  const others = await tx.user.count({ where: { role: "FOUNDER", status: "ACTIVE", id: { not: userId } } });
  if (others === 0) throw new AdminError("This is the last active super admin. Make another user a super admin first.");
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function inviteUser(
  actor: AdminActor,
  input: { name: string; email: string; role: UserRole; businessIds: string[] }
): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    if (!assignableRoles(actor.role).includes(input.role)) throw new AdminError("You can't invite users with that role.");
    // Without role-assignment rights, only operators and read-only analysts can be invited.
    if (!actor.permissions.includes("users.roles") && input.role !== "OPERATOR" && input.role !== "ANALYST") {
      throw new AdminError("Only a super admin can invite staff with that role.");
    }
    if (input.role === "OPERATOR" && input.businessIds.length === 0) throw new AdminError("Link a tourism operator to at least one business.");
    const email = input.email.trim().toLowerCase();
    const businesses = await prisma.operator.findMany({ where: { id: { in: input.businessIds } }, select: { id: true } });
    if (businesses.length !== new Set(input.businessIds).size) throw new AdminError("One of the selected businesses no longer exists.");

    const existing = await prisma.user.findUnique({ where: { email } });
    // A never-activated account (pending, or a revoked invitation) can be
    // re-invited; anything that has ever had a password cannot.
    const reinvitable = existing && !existing.passwordHash && (existing.status === "PENDING" || existing.status === "ARCHIVED");
    if (existing && !reinvitable) throw new AdminError("An account with that email already exists.");
    if (existing) guardTarget(actor, existing);
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { name: input.name, role: input.role, status: "PENDING" } })
      : await prisma.user.create({ data: { email, name: input.name, role: input.role, status: "PENDING" } });
    if (input.businessIds.length) {
      await prisma.userBusiness.createMany({ data: input.businessIds.map((operatorId) => ({ userId: user.id, operatorId })), skipDuplicates: true });
      if (input.role === "OPERATOR") await prisma.user.update({ where: { id: user.id }, data: { operatorId: input.businessIds[0] } });
    }
    const delivery = await sendAccountLink(user.id, "INVITE", { actorId: actor.id, actorName: actor.name, allowManualLink: actor.role === "FOUNDER" });
    await audit(actor.id, "user.invite", "user", user.id, `Invited ${email} as ${ROLE_LABELS[input.role]}${delivery.emailed ? "" : " (email not sent)"}`, {
      role: input.role, businessIds: input.businessIds,
    });
    return { ok: true, userId: user.id, delivery, message: deliveryMessage(delivery, `Invitation sent to ${email}.`) };
  });
}

function deliveryMessage(d: Delivery, sent: string) {
  if (d.emailed) return sent;
  if (d.manualLink) return "Email isn't configured, so nothing was sent. Copy the single-use link below and share it with the person directly.";
  return "Email isn't configured or failed, so nothing was sent. Configure RESEND_API_KEY and EMAIL_FROM, then resend.";
}

export async function resendInvite(actor: AdminActor, userId: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    if (u.status !== "PENDING") throw new AdminError("Only pending invitations can be resent.");
    const delivery = await sendAccountLink(u.id, "INVITE", { actorId: actor.id, actorName: actor.name, allowManualLink: actor.role === "FOUNDER" });
    await audit(actor.id, "user.invite_resent", "user", u.id, `Resent invitation to ${u.email}`);
    return { ok: true, delivery, message: deliveryMessage(delivery, `Invitation resent to ${u.email}. Earlier links no longer work.`) };
  });
}

export async function revokeInvite(actor: AdminActor, userId: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    if (u.status !== "PENDING") throw new AdminError("This invitation has already been accepted.");
    await revokeTokens(u.id, "INVITE");
    await prisma.user.update({ where: { id: u.id }, data: { status: "ARCHIVED" } });
    await audit(actor.id, "user.invite_revoked", "user", u.id, `Revoked invitation for ${u.email}`);
    return { ok: true, message: "Invitation revoked. The link no longer works." };
  });
}

// ---------------------------------------------------------------------------
// Status, role, sessions, password reset
// ---------------------------------------------------------------------------

const STATUS_ACTIONS: Record<UserStatus, string> = {
  ACTIVE: "user.reactivate", SUSPENDED: "user.suspend", ARCHIVED: "user.deactivate", PENDING: "user.pending",
};

export async function setUserStatus(actor: AdminActor, userId: string, status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    if (userId === actor.id) throw new AdminError("You can't change the status of your own account.");
    const before = await serializable(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      guardTarget(actor, u);
      if (u.status === "PENDING") throw new AdminError("Revoke or resend the invitation instead.");
      if (u.status === status) throw new AdminError(`Already ${USER_STATUS_LABELS[status].toLowerCase()}.`);
      if (status === "ACTIVE" && !u.passwordHash) throw new AdminError("This account has no password yet; send a new invitation instead.");
      if (u.role === "FOUNDER" && status !== "ACTIVE") await assertAnotherSuperAdmin(tx, u.id);
      await tx.user.update({ where: { id: u.id }, data: { status } });
      return u;
    });
    let extra = "";
    if (status !== "ACTIVE") {
      const n = await revokeUserSessions(userId);
      await revokeTokens(userId, ["PASSWORD_RESET", "EMAIL_VERIFY", "INVITE"]);
      extra = `; ${n} session(s) signed out`;
    }
    await audit(actor.id, STATUS_ACTIONS[status], "user", userId, `${USER_STATUS_LABELS[before.status]} → ${USER_STATUS_LABELS[status]} for ${before.email}${extra}`, {
      status: { from: before.status, to: status },
    });
    return { ok: true, message: `${before.name} is now ${USER_STATUS_LABELS[status].toLowerCase()}.` };
  });
}

export async function changeRole(actor: AdminActor, userId: string, role: UserRole): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.roles");
    if (userId === actor.id) throw new AdminError("You can't change your own role. Ask another super admin.");
    if (!assignableRoles(actor.role).includes(role)) throw new AdminError("You can't assign that role.");
    const before = await serializable(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { businesses: { select: { operatorId: true } } } });
      guardTarget(actor, u);
      if (u.role === role) throw new AdminError(`Already ${ROLE_LABELS[role]}.`);
      if (u.role === "FOUNDER") await assertAnotherSuperAdmin(tx, u.id);
      if (role === "OPERATOR" && u.businesses.length === 0) throw new AdminError("Link this user to a business before making them a tourism operator.");
      await tx.user.update({
        where: { id: u.id },
        data: { role, operatorId: role === "OPERATOR" ? u.operatorId ?? u.businesses[0].operatorId : null },
      });
      // Per-user overrides were chosen for the old role; drop them rather
      // than silently carrying grants across a role change.
      await tx.userPermission.deleteMany({ where: { userId: u.id } });
      return u;
    });
    // Sign the user out so the new role applies from a fresh session.
    const n = await revokeUserSessions(userId);
    await audit(actor.id, "user.role_change", "user", userId, `Role ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[role]} for ${before.email}; ${n} session(s) signed out`, {
      role: { from: before.role, to: role },
    });
    return { ok: true, message: `${before.name} is now ${ROLE_LABELS[role]}.` };
  });
}

export async function sendPasswordReset(actor: AdminActor, userId: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    if (u.status !== "ACTIVE") throw new AdminError("Only active accounts can reset their password.");
    const delivery = await sendAccountLink(u.id, "PASSWORD_RESET", { actorId: actor.id, allowManualLink: actor.role === "FOUNDER" && u.id !== actor.id });
    await audit(actor.id, "password.reset_sent", "user", u.id, `Sent password reset link to ${u.email}${delivery.emailed ? "" : " (email not sent)"}`);
    return { ok: true, delivery, message: deliveryMessage(delivery, `Password reset link sent to ${u.email}. It expires in 1 hour.`) };
  });
}

export async function revokeSessionsFor(actor: AdminActor, userId: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    if (userId === actor.id) throw new AdminError("Manage your own sessions from your account page.");
    const n = await revokeUserSessions(userId);
    await audit(actor.id, "session.revoke_all", "user", userId, `Signed ${u.email} out of ${n} session(s)`);
    return { ok: true, message: `Signed out of ${n} session(s).` };
  });
}

export async function updateProfile(actor: AdminActor, userId: string, name: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    await prisma.user.update({ where: { id: userId }, data: { name } });
    await audit(actor.id, "update", "user", userId, `Renamed ${u.email}`, { name: { from: u.name, to: name } });
    return { ok: true, message: "Saved." };
  });
}

// ---------------------------------------------------------------------------
// Business links
// ---------------------------------------------------------------------------

export async function linkBusiness(actor: AdminActor, userId: string, operatorId: string, isPrimaryContact = false): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const [u, op] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { id: true, name: true } }),
    ]);
    guardTarget(actor, u);
    await prisma.userBusiness.upsert({
      where: { userId_operatorId: { userId, operatorId } },
      create: { userId, operatorId, isPrimaryContact },
      update: { isPrimaryContact },
    });
    if (u.role === "OPERATOR" && !u.operatorId) await prisma.user.update({ where: { id: userId }, data: { operatorId } });
    await audit(actor.id, "user.business_link", "user", userId, `Linked ${u.email} to ${op.name}${isPrimaryContact ? " (primary contact)" : ""}`, { operatorId });
    return { ok: true, message: `Linked to ${op.name}.` };
  });
}

export async function unlinkBusiness(actor: AdminActor, userId: string, operatorId: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.manage");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { businesses: true } });
    guardTarget(actor, u);
    const remaining = u.businesses.filter((b) => b.operatorId !== operatorId);
    if (u.role === "OPERATOR" && remaining.length === 0 && u.status === "ACTIVE") {
      throw new AdminError("A tourism operator needs at least one business. Link another first, or deactivate the account.");
    }
    await prisma.userBusiness.delete({ where: { userId_operatorId: { userId, operatorId } } });
    if (u.operatorId === operatorId) await prisma.user.update({ where: { id: userId }, data: { operatorId: remaining[0]?.operatorId ?? null } });
    const op = await prisma.operator.findUnique({ where: { id: operatorId }, select: { name: true } });
    await audit(actor.id, "user.business_unlink", "user", userId, `Removed ${u.email} from ${op?.name ?? operatorId}`, { operatorId });
    return { ok: true, message: "Business link removed. Access to it ends immediately." };
  });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** granted: true = grant, false = deny, null = inherit from role. */
export async function setUserPermission(actor: AdminActor, userId: string, permission: string, granted: boolean | null): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.roles");
    if (!isPermission(permission)) throw new AdminError("Unknown permission.");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    guardTarget(actor, u);
    if (u.role === "FOUNDER") throw new AdminError("Super admins always hold every permission.");
    if (granted && !assignable(u.role, permission)) throw new AdminError(`${PERMISSIONS[permission].label} can't be granted to a ${ROLE_LABELS[u.role]}.`);
    if (granted === null) await prisma.userPermission.deleteMany({ where: { userId, permission } });
    else
      await prisma.userPermission.upsert({
        where: { userId_permission: { userId, permission } },
        create: { userId, permission, granted, updatedById: actor.id },
        update: { granted, updatedById: actor.id },
      });
    const verb = granted === null ? "Reset to role default" : granted ? "Granted" : "Denied";
    await audit(actor.id, "permission.user_change", "user", userId, `${verb}: ${PERMISSIONS[permission].label} for ${u.email}`, { permission, granted });
    return { ok: true, message: `${verb}: ${PERMISSIONS[permission].label}.` };
  });
}

export async function setRolePermission(actor: AdminActor, role: UserRole, permission: string, granted: boolean | null): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.roles");
    if (!isPermission(permission)) throw new AdminError("Unknown permission.");
    if (role === "FOUNDER") throw new AdminError("Super admins always hold every permission.");
    if (granted && !assignable(role, permission)) throw new AdminError(`${PERMISSIONS[permission].label} can't be granted to ${ROLE_LABELS[role]}.`);
    if (granted === null) await prisma.rolePermission.deleteMany({ where: { role, permission } });
    else
      await prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission, granted, updatedById: actor.id },
        update: { granted, updatedById: actor.id },
      });
    const verb = granted === null ? "Reset to default" : granted ? "Granted" : "Removed";
    await audit(actor.id, "permission.role_change", "role", role, `${verb}: ${PERMISSIONS[permission].label} for every ${ROLE_LABELS[role]}`, { role, permission, granted });
    return { ok: true, message: `${verb}: ${PERMISSIONS[permission].label} for ${ROLE_LABELS[role]}.` };
  });
}

/**
 * Sets exactly which permissions a role holds (from the super admin's role
 * matrix). Stores only differences from the code defaults, audits each one.
 */
export async function setRolePermissionSet(actor: AdminActor, role: UserRole, wanted: readonly string[]): Promise<AdminResult> {
  return wrap(async () => {
    need(actor, "users.roles");
    if (role === "FOUNDER") throw new AdminError("Super admins always hold every permission.");
    const want = new Set(wanted.filter(isPermission));
    const defaults = new Set<string>(ROLE_DEFAULTS[role]);
    const current = await prisma.rolePermission.findMany({ where: { role } });
    const now = new Set(effectivePermissions(role, current));
    const changes: { permission: Permission; granted: boolean }[] = [];
    for (const p of ALL_PERMISSIONS) {
      if (!assignable(role, p)) continue;
      const on = want.has(p);
      if (on !== now.has(p)) changes.push({ permission: p, granted: on });
    }
    if (changes.length === 0) return { ok: true, message: "No changes." };
    await prisma.$transaction(async (tx) => {
      for (const c of changes) {
        if (c.granted === defaults.has(c.permission)) await tx.rolePermission.deleteMany({ where: { role, permission: c.permission } });
        else
          await tx.rolePermission.upsert({
            where: { role_permission: { role, permission: c.permission } },
            create: { role, permission: c.permission, granted: c.granted, updatedById: actor.id },
            update: { granted: c.granted, updatedById: actor.id },
          });
      }
    });
    for (const c of changes) {
      await audit(actor.id, "permission.role_change", "role", role, `${c.granted ? "Granted" : "Removed"}: ${PERMISSIONS[c.permission].label} for every ${ROLE_LABELS[role]}`, {
        role, permission: c.permission, granted: c.granted,
      });
    }
    return { ok: true, message: `${changes.length} permission change(s) saved for ${ROLE_LABELS[role]}. They apply on each user's next request.` };
  });
}
