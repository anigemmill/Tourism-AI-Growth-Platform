"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, type ActionState } from "@/lib/forms";
import { validateStages } from "@/lib/domain/programme";

export async function updateProgramme(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("programme.edit");
  const parsed = parseForm(z.object({ name: f.str(), description: f.optStr(), startDate: f.date(), totalWeeks: f.int(1, 52) }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const p = await prisma.programme.findUniqueOrThrow({ where: { id }, include: { stages: true } });
    const err = validateStages(p.stages, parsed.data.totalWeeks);
    if (err) return { error: `Shorten or edit stages first: ${err}` };
    await prisma.programme.update({ where: { id }, data: { ...parsed.data, description: parsed.data.description ?? null } });
    await audit(user.id, "update", "programme", id, `Programme settings updated (start ${parsed.data.startDate.toISOString().slice(0, 10)}, ${parsed.data.totalWeeks} weeks)`, { startDate: { from: p.startDate.toISOString(), to: parsed.data.startDate.toISOString() } });
    revalidatePath("/", "layout");
    return { ok: "Programme updated — all week dates recalculated" };
  });
}

export async function updateStages(programmeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("programme.edit");
  return guarded(async () => {
    const p = await prisma.programme.findUniqueOrThrow({ where: { id: programmeId }, include: { stages: true } });
    const next = p.stages.map((s) => ({
      id: s.id,
      name: String(fd.get(`${s.id}.name`) ?? s.name).trim() || s.name,
      startWeek: Number(fd.get(`${s.id}.startWeek`)),
      endWeek: Number(fd.get(`${s.id}.endWeek`)),
      goals: String(fd.get(`${s.id}.goals`) ?? "").split("\n").map((g) => g.trim()).filter(Boolean),
    }));
    if (next.some((s) => !Number.isInteger(s.startWeek) || !Number.isInteger(s.endWeek))) return { error: "Weeks must be whole numbers." };
    const err = validateStages(next, p.totalWeeks);
    if (err) return { error: err };
    await prisma.$transaction(next.map((s) => prisma.programmeStage.update({ where: { id: s.id }, data: { name: s.name, startWeek: s.startWeek, endWeek: s.endWeek, goals: s.goals } })));
    await audit(user.id, "update", "programme.stages", programmeId, "Stages updated");
    revalidatePath("/programme");
    return { ok: "Stages saved" };
  });
}

export async function addMilestone(programmeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("programme.edit");
  const parsed = parseForm(z.object({ title: f.str(), week: f.int(1, 52), notes: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const m = await prisma.milestone.create({ data: { programmeId, title: parsed.data.title, week: parsed.data.week, notes: parsed.data.notes ?? null } });
    await audit(user.id, "create", "milestone", m.id, `Milestone: ${m.title}`);
    revalidatePath("/programme");
    return { ok: "Milestone added" };
  });
}

export async function setMilestoneStatus(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("programme.edit");
  const status = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).safeParse(fd.get("status"));
  if (!status.success) return { error: "Invalid status" };
  return guarded(async () => {
    await prisma.milestone.update({ where: { id }, data: { status: status.data } });
    await audit(user.id, "update", "milestone", id, `Milestone → ${status.data}`);
    revalidatePath("/", "layout");
    return { ok: "Updated" };
  });
}
