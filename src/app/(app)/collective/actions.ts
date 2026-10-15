"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { visibilityChangeError } from "@/lib/authz";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";
import { activeProgramme } from "@/lib/queries";

const VIS = z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]);
const CULT = z.enum(["NOT_APPLICABLE", "REQUIRED", "APPROVED"]);
const WORK = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);

const workshopSchema = z.object({
  title: f.str(), week: f.int(1, 52), date: f.optDate(), location: f.optStr(), agenda: f.optStr(), notes: f.optStr(), status: WORK,
});

export async function createWorkshop(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(workshopSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const p = await activeProgramme();
    if (!p) return { error: "No active programme" };
    const w = await prisma.workshop.create({ data: { ...nullify(parsed.data), programmeId: p.id } as never });
    await audit(user.id, "create", "workshop", w.id, `Workshop: ${w.title}`);
    revalidatePath("/collective");
    return { ok: "Workshop added" };
  });
}

export async function updateWorkshop(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(workshopSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    await prisma.workshop.update({ where: { id }, data: nullify(parsed.data) as never });
    await audit(user.id, "update", "workshop", id, "Workshop updated");
    revalidatePath(`/collective/workshops/${id}`);
    return { ok: "Saved" };
  });
}

/** Attendance grid: one checkbox + engagement per operator. */
export async function saveAttendance(workshopId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  return guarded(async () => {
    const w = await prisma.workshop.findUniqueOrThrow({ where: { id: workshopId } });
    const ops = await prisma.operator.findMany({ where: { programmeId: w.programmeId }, select: { id: true } });
    await prisma.$transaction(
      ops.map((o) => {
        const eng = Number(fd.get(`${o.id}.engagement`));
        const data = {
          attended: fd.get(`${o.id}.attended`) === "on",
          engagement: Number.isInteger(eng) && eng >= 1 && eng <= 5 ? eng : null,
          notes: (String(fd.get(`${o.id}.notes`) ?? "").trim() || null),
        };
        return prisma.workshopAttendance.upsert({
          where: { workshopId_operatorId: { workshopId, operatorId: o.id } },
          update: data,
          create: { workshopId, operatorId: o.id, ...data },
        });
      })
    );
    await audit(user.id, "update", "workshop.attendance", workshopId, "Attendance recorded");
    revalidatePath(`/collective/workshops/${workshopId}`);
    return { ok: "Attendance saved" };
  });
}

const learningSchema = z.object({
  title: f.str(), body: f.str(), topic: f.optStr(), operatorId: f.optId(), workshopId: f.optId(), initiativeId: f.optId(),
  isReusableProcess: f.bool(), visibility: VIS, culturalReview: CULT, culturalApprovedBy: f.optStr(),
});

export async function createLearning(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(learningSchema, fd);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  if (d.culturalReview === "APPROVED" && !d.culturalApprovedBy) return { error: "Name who approved the cultural content." };
  return guarded(async () => {
    const op = d.operatorId ? await prisma.operator.findUnique({ where: { id: d.operatorId } }) : null;
    const err = visibilityChangeError(d.visibility, op, d.culturalReview);
    if (err) return { error: err };
    const l = await prisma.learning.create({ data: { ...nullify(d), createdBy: user.name } as never });
    await audit(user.id, "create", "learning", l.id, `Learning: ${l.title} (${l.visibility})`);
    revalidatePath("/collective");
    return { ok: "Learning recorded" };
  });
}

export async function setLearningVisibility(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(z.object({ visibility: VIS, culturalReview: CULT, culturalApprovedBy: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const l = await prisma.learning.findUniqueOrThrow({ where: { id }, include: { operator: true } });
    if (parsed.data.culturalReview === "APPROVED" && !parsed.data.culturalApprovedBy && !l.culturalApprovedBy) return { error: "Name who approved the cultural content." };
    const err = visibilityChangeError(parsed.data.visibility, l.operator, parsed.data.culturalReview);
    if (err) return { error: err };
    await prisma.learning.update({ where: { id }, data: { visibility: parsed.data.visibility, culturalReview: parsed.data.culturalReview, culturalApprovedBy: parsed.data.culturalApprovedBy ?? l.culturalApprovedBy } });
    await audit(user.id, "update", "learning", id, `Visibility ${l.visibility} → ${parsed.data.visibility}`, { visibility: { from: l.visibility, to: parsed.data.visibility } });
    revalidatePath("/collective");
    return { ok: "Updated" };
  });
}

export async function createResource(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(z.object({ title: f.str(), description: f.optStr(), url: f.url(), resourceType: f.str(), visibility: VIS, culturalReview: CULT }), fd);
  if (parsed.error) return parsed.error;
  if (parsed.data.culturalReview === "REQUIRED" && parsed.data.visibility !== "INTERNAL") return { error: "Resources needing cultural review stay internal until approved." };
  return guarded(async () => {
    const r = await prisma.resource.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "resource", r.id, `Resource: ${r.title}`);
    revalidatePath("/collective");
    return { ok: "Resource added" };
  });
}

const initiativeSchema = z.object({
  title: f.str(), description: f.str(), initiativeType: f.str(), status: WORK, attributionMethod: f.optStr(), results: f.optStr(),
});

export async function createInitiative(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(initiativeSchema, fd);
  if (parsed.error) return parsed.error;
  let id = "";
  const res = await guarded(async () => {
    const p = await activeProgramme();
    const i = await prisma.sharedInitiative.create({ data: { ...nullify(parsed.data), programmeId: p?.id ?? null } as never });
    id = i.id;
    await audit(user.id, "create", "initiative", i.id, `Initiative: ${i.title}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  redirect(`/collective/initiatives/${id}`);
}

export async function updateInitiative(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(initiativeSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    await prisma.sharedInitiative.update({ where: { id }, data: nullify(parsed.data) as never });
    await audit(user.id, "update", "initiative", id, "Initiative updated");
    revalidatePath(`/collective/initiatives/${id}`);
    return { ok: "Saved" };
  });
}

export async function upsertParticipant(initiativeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("collective.edit");
  const parsed = parseForm(
    z.object({
      operatorId: f.str(), role: f.optStr(), responsibilities: f.optStr(), attributedBookings: f.optInt(0, 1_000_000),
      attributedRevenueNzd: f.optNum(), consentConfirmed: f.bool(),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const { operatorId, ...rest } = nullify(parsed.data);
    await prisma.initiativeParticipant.upsert({
      where: { initiativeId_operatorId: { initiativeId, operatorId: operatorId! } },
      update: rest as never,
      create: { initiativeId, operatorId: operatorId!, ...(rest as object) },
    });
    await audit(user.id, "update", "initiative.participant", initiativeId, "Participant saved");
    revalidatePath(`/collective/initiatives/${initiativeId}`);
    return { ok: "Participant saved" };
  });
}
