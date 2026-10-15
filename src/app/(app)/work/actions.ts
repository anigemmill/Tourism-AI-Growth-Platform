"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const WORK = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);
const VIS = z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]);

const taskSchema = z.object({
  title: f.str(),
  description: f.optStr(),
  operatorId: f.optId(),
  projectId: f.optId(),
  initiativeId: f.optId(),
  workshopId: f.optId(),
  assigneeId: f.optId(),
  ownerLabel: f.optStr(),
  dueDate: f.optDate(),
  priority: z.enum(["NOW", "NEXT", "LATER", "IGNORE"]).default("NOW"),
  visibility: VIS.default("CONFIDENTIAL"),
});

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("work.edit");
  const parsed = parseForm(taskSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const data = nullify(parsed.data);
    if (!data.operatorId && data.visibility === "CONFIDENTIAL" && !data.initiativeId) data.visibility = "INTERNAL";
    const t = await prisma.task.create({ data: data as never });
    await audit(user.id, "create", "task", t.id, `Created task: ${t.title}`);
    revalidatePath("/", "layout");
    return { ok: "Task added" };
  });
}

export async function setTaskStatus(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("work.edit");
  const status = WORK.safeParse(fd.get("status"));
  if (!status.success) return { error: "Invalid status" };
  return guarded(async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id } });
    await prisma.task.update({
      where: { id },
      data: { status: status.data, completedAt: status.data === "DONE" ? new Date() : null },
    });
    await audit(user.id, "update", "task", id, `Task "${before.title}" → ${status.data}`, { status: { from: before.status, to: status.data } });
    revalidatePath("/", "layout");
    return { ok: "Updated" };
  });
}

const projectSchema = z.object({
  title: f.str(),
  description: f.optStr(),
  operatorId: f.optId(),
  opportunityId: f.optId(),
  initiativeId: f.optId(),
  status: WORK.default("TODO"),
  startDate: f.optDate(),
  dueDate: f.optDate(),
  tools: f.list(),
  oneOffCostNzd: f.optNum(),
  monthlyCostNzd: f.optNum(),
  testingNotes: f.optStr(),
  approvedBy: f.optStr(),
  approvedAt: f.optDate(),
  adoption: f.optStr(),
  visibility: VIS.default("CONFIDENTIAL"),
});

export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("work.edit");
  const parsed = parseForm(projectSchema, fd);
  if (parsed.error) return parsed.error;
  let id = "";
  const res = await guarded(async () => {
    const p = await prisma.project.create({ data: nullify(parsed.data) as never });
    id = p.id;
    if (p.opportunityId) {
      await prisma.opportunity.update({ where: { id: p.opportunityId }, data: { status: "IN_PROGRESS" } });
    }
    await audit(user.id, "create", "project", p.id, `Created project: ${p.title}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  revalidatePath("/work");
  redirect(`/work/projects/${id}`);
}

export async function updateProject(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("work.edit");
  const parsed = parseForm(projectSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    const data = nullify(parsed.data);
    await prisma.project.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "project", id, `Updated project: ${data.title}`, diff(before, data));
    revalidatePath(`/work/projects/${id}`);
    return { ok: "Saved" };
  });
}
