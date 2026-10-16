// Business (Operator) account administration: account status, enabled
// portal features, programme/cohort. Profile fields are edited on the
// existing operator edit page.

import { prisma } from "@/lib/prisma";
import type { BusinessAccountStatus } from "@/generated/prisma";
import { audit } from "@/lib/audit";
import { FEATURES, isFeature } from "@/lib/rbac/features";
import type { BrandId } from "@/lib/brand";
import { ACCOUNT_STATUS_LABELS } from "@/lib/labels";
import { AdminError, type AdminActor, type AdminResult } from "./users";

function need(actor: AdminActor) {
  if (!actor.permissions.includes("businesses.manage")) throw new AdminError("You don't have permission to do that.");
}

async function wrap(fn: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AdminError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setAccountStatus(actor: AdminActor, operatorId: string, status: BusinessAccountStatus): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { name: true, accountStatus: true } });
    if (op.accountStatus === status) throw new AdminError(`Already ${ACCOUNT_STATUS_LABELS[status].toLowerCase()}.`);
    await prisma.operator.update({ where: { id: operatorId }, data: { accountStatus: status } });
    // Operator users lose access on their next request (checked per request
    // in src/lib/auth/core.ts); no session surgery needed.
    await audit(actor.id, "business.status", "operator", operatorId, `${op.name}: ${ACCOUNT_STATUS_LABELS[op.accountStatus]} → ${ACCOUNT_STATUS_LABELS[status]}`, {
      accountStatus: { from: op.accountStatus, to: status },
    });
    return { ok: true, message: `${op.name} is now ${ACCOUNT_STATUS_LABELS[status].toLowerCase()}.` };
  });
}

export async function setFeature(actor: AdminActor, operatorId: string, feature: string, enabled: boolean): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    if (!isFeature(feature)) throw new AdminError("Unknown feature.");
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { name: true } });
    await prisma.businessFeature.upsert({
      where: { operatorId_feature: { operatorId, feature } },
      create: { operatorId, feature, enabled, updatedById: actor.id },
      update: { enabled, updatedById: actor.id },
    });
    await audit(actor.id, "business.feature", "operator", operatorId, `${enabled ? "Enabled" : "Disabled"} ${FEATURES[feature].label} for ${op.name}`, { feature, enabled });
    return { ok: true, message: `${FEATURES[feature].label} ${enabled ? "enabled" : "disabled"}.` };
  });
}

export async function setProgramme(actor: AdminActor, operatorId: string, programmeId: string | null, cohort: string | null): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { name: true, programmeId: true, cohort: true } });
    if (programmeId && !(await prisma.programme.findUnique({ where: { id: programmeId }, select: { id: true } }))) throw new AdminError("Programme not found.");
    await prisma.operator.update({ where: { id: operatorId }, data: { programmeId, cohort } });
    await audit(actor.id, "business.programme", "operator", operatorId, `Programme/cohort updated for ${op.name}`, {
      programmeId: { from: op.programmeId, to: programmeId }, cohort: { from: op.cohort, to: cohort },
    });
    return { ok: true, message: "Programme and cohort saved." };
  });
}

/** Onboarding checklist derived from existing records (nothing extra to maintain). */
export function onboardingSteps(b: {
  dataAgreementSignedAt: Date | null;
  contactEmail: string | null;
  members: number;
  activeMembers: number;
  assessments: number;
  hasProfile: boolean;
  programmeId: string | null;
}, brand: BrandId) {
  const steps = [
    { label: "Primary contact recorded", done: Boolean(b.contactEmail) },
    // Findable clients aren't enrolled in a cohort programme.
    ...(brand === "findable" ? [] : [{ label: "Enrolled in a programme", done: Boolean(b.programmeId) }]),
    { label: "Data agreement signed", done: Boolean(b.dataAgreementSignedAt) },
    { label: "User invited", done: b.members > 0 },
    { label: "User has activated their account", done: b.activeMembers > 0 },
    { label: "Business profile completed", done: b.hasProfile },
    { label: "AI assessment started", done: b.assessments > 0 },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}
