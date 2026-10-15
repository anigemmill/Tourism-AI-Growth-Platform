"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const WORK = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);

export async function createRisk(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.edit");
  const parsed = parseForm(z.object({ kind: z.enum(["RISK", "BLOCKER", "ISSUE"]), title: f.str(), detail: f.optStr(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), operatorId: f.optId(), owner: f.optStr(), mitigation: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const r = await prisma.risk.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "risk", r.id, `${r.kind}: ${r.title}`);
    revalidatePath("/governance");
    return { ok: "Recorded" };
  });
}

export async function updateRisk(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.edit");
  const parsed = parseForm(z.object({ status: WORK, mitigation: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    await prisma.risk.update({ where: { id }, data: { status: parsed.data.status, mitigation: parsed.data.mitigation ?? null } });
    await audit(user.id, "update", "risk", id, `Risk → ${parsed.data.status}`);
    revalidatePath("/governance");
    return { ok: "Saved" };
  });
}

export async function createDecision(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.edit");
  const parsed = parseForm(z.object({ title: f.str(), whatChanged: f.str(), evidence: f.optStr(), whyItMatters: f.optStr(), nextAction: f.optStr(), owner: f.optStr(), reviewDate: f.optDate(), operatorId: f.optId() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const d = await prisma.decisionRecord.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "decision", d.id, `Decision: ${d.title}`);
    revalidatePath("/governance");
    return { ok: "Recorded" };
  });
}

export async function resolveDecision(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.edit");
  const parsed = parseForm(z.object({ outcome: f.str() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    await prisma.decisionRecord.update({ where: { id }, data: { decided: true, outcome: parsed.data.outcome } });
    await audit(user.id, "decision", "decision", id, `Decided: ${parsed.data.outcome}`);
    revalidatePath("/governance");
    return { ok: "Decision recorded" };
  });
}
