"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { visibilityChangeError } from "@/lib/authz";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const AREA = z.enum([
  "AI_SEARCH_VISIBILITY", "MARKETING_CONTENT", "ENQUIRIES_CONVERSION", "BOOKING_JOURNEY", "GUEST_COMMUNICATIONS",
  "ADMIN_WORKLOAD", "REPORTING_DECISIONS", "OPERATIONS", "FEEDBACK_PRODUCT",
]);
const SOLUTION = z.enum(["AI_ASSISTED", "AUTOMATION", "PROCESS_CHANGE", "WEBSITE_CONTENT", "TRAINING", "OTHER"]);
const VIS = z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]);

const oppSchema = z.object({
  operatorId: f.optId(),
  initiativeId: f.optId(),
  assessmentId: f.optId(),
  templateId: f.optId(),
  title: f.str(),
  area: AREA,
  solutionType: SOLUTION,
  problem: f.str(),
  currentProcess: f.optStr(),
  proposedSolution: f.str(),
  expectedValue: f.optStr(),
  expectedValueNzd: f.optNum(),
  impactScore: f.int(1, 5),
  effortScore: f.int(1, 5),
  effortHours: f.optInt(0, 10000),
  oneOffCostNzd: f.optNum(),
  monthlyCostNzd: f.optNum(),
  dataRequirements: f.optStr(),
  risks: f.optStr(),
  dependencies: f.optStr(),
  tools: f.list(),
  successMetric: f.optStr(),
  baselineMetric: f.optStr(),
  targetMetric: f.optStr(),
  actualResult: f.optStr(),
  evidenceBasis: z.enum(["OBSERVED", "OPERATOR_REPORTED", "MEASURED", "THIRD_PARTY", "HYPOTHESIS"]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  horizon: z.enum(["NOW", "NEXT", "LATER", "IGNORE"]),
  status: z.enum(["IDENTIFIED", "PRIORITISED", "APPROVED", "IN_PROGRESS", "LIVE", "MEASURING", "CLOSED", "REJECTED"]),
  ownerId: f.optId(),
  visibility: VIS,
});

async function consentCheck(operatorId: string | null | undefined, visibility: z.infer<typeof VIS>) {
  const op = operatorId ? await prisma.operator.findUnique({ where: { id: operatorId } }) : null;
  return visibilityChangeError(visibility, op);
}

export async function createOpportunity(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  const parsed = parseForm(oppSchema, fd);
  if (parsed.error) return parsed.error;
  if (!parsed.data.operatorId && !parsed.data.initiativeId) return { error: "Choose an operator or a shared initiative." };
  let id = "";
  const res = await guarded(async () => {
    const consentErr = await consentCheck(parsed.data.operatorId, parsed.data.visibility);
    if (consentErr) return { error: consentErr };
    const o = await prisma.opportunity.create({ data: nullify(parsed.data) as never });
    id = o.id;
    await audit(user.id, "create", "opportunity", o.id, `Recorded opportunity: ${o.title}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  revalidatePath("/opportunities");
  redirect(`/opportunities/${id}`);
}

export async function updateOpportunity(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  const parsed = parseForm(oppSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const before = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    const consentErr = before.visibility !== parsed.data.visibility ? await consentCheck(parsed.data.operatorId, parsed.data.visibility) : null;
    if (consentErr) return { error: consentErr };
    const data = nullify(parsed.data);
    await prisma.opportunity.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "opportunity", id, `Updated opportunity: ${data.title}`, diff(before, data));
    revalidatePath(`/opportunities/${id}`);
    return { ok: "Saved" };
  });
}

const decisionSchema = z.object({
  decision: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["SCALE", "AMEND", "STOP", "INVESTIGATE"]).optional()),
  decisionNotes: f.optStr(),
  actualResult: f.optStr(),
});

export async function recordDecision(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  const parsed = parseForm(decisionSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const data = nullify(parsed.data);
    const extra = data.decision === "STOP" ? { status: "CLOSED" as const } : {};
    await prisma.opportunity.update({ where: { id }, data: { ...data, ...extra } as never });
    await audit(user.id, "decision", "opportunity", id, `Decision: ${data.decision ?? "cleared"}`, data as never);
    revalidatePath(`/opportunities/${id}`);
    return { ok: "Decision recorded" };
  });
}

export async function convertToProject(id: string): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  let pid = "";
  const res = await guarded(async () => {
    const o = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    const p = await prisma.project.create({
      data: {
        title: o.title, description: o.proposedSolution, operatorId: o.operatorId, initiativeId: o.initiativeId, opportunityId: o.id,
        tools: o.tools, oneOffCostNzd: o.oneOffCostNzd, monthlyCostNzd: o.monthlyCostNzd, visibility: o.visibility === "INTERNAL" ? "INTERNAL" : "CONFIDENTIAL",
      },
    });
    await prisma.opportunity.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await audit(user.id, "create", "project", p.id, `Converted opportunity "${o.title}" to project`);
    pid = p.id;
    return { ok: "Created" };
  });
  if (res?.error) return res;
  redirect(`/work/projects/${pid}`);
}

const templateSchema = z.object({
  name: f.str(),
  area: AREA,
  solutionType: SOLUTION,
  description: f.str(),
  steps: f.optStr(),
  typicalEffortHours: f.optInt(0, 10000),
  typicalOneOffNzd: f.optNum(),
  typicalMonthlyNzd: f.optNum(),
  tools: f.list(),
  successMetric: f.optStr(),
  workflowAssetId: f.optId(),
});

export async function createTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  const parsed = parseForm(templateSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const t = await prisma.solutionTemplate.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "template", t.id, `Created solution template: ${t.name}`);
    revalidatePath("/opportunities/templates");
    return { ok: "Template saved" };
  });
}

/** Create one opportunity per selected operator from a proven template. */
export async function applyTemplate(templateId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("opportunities.edit");
  const operatorIds = fd.getAll("operatorIds").map(String).filter(Boolean);
  if (operatorIds.length === 0) return { error: "Select at least one operator." };
  return guarded(async () => {
    const t = await prisma.solutionTemplate.findUniqueOrThrow({ where: { id: templateId } });
    const existing = await prisma.opportunity.findMany({ where: { templateId, operatorId: { in: operatorIds } }, select: { operatorId: true } });
    const skip = new Set(existing.map((e) => e.operatorId));
    const targets = operatorIds.filter((id) => !skip.has(id));
    await prisma.opportunity.createMany({
      data: targets.map((operatorId) => ({
        operatorId, templateId, title: t.name, area: t.area, solutionType: t.solutionType,
        problem: "To confirm with operator (created from template).", proposedSolution: t.description,
        effortHours: t.typicalEffortHours, oneOffCostNzd: t.typicalOneOffNzd, monthlyCostNzd: t.typicalMonthlyNzd,
        tools: t.tools, successMetric: t.successMetric, evidenceBasis: "HYPOTHESIS" as const, status: "IDENTIFIED" as const, ownerId: user.id,
      })),
    });
    await audit(user.id, "create", "opportunity", null, `Applied template "${t.name}" to ${targets.length} operator(s)`);
    revalidatePath("/opportunities");
    return { ok: `Created ${targets.length} opportunit${targets.length === 1 ? "y" : "ies"}${skip.size ? ` (${skip.size} already had it)` : ""}.` };
  });
}
