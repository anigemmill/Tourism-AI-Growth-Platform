"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const METRIC = z.enum([
  "QUALIFIED_ENQUIRIES", "BOOKING_CONVERSION", "BOOKING_VALUE", "ATTRIBUTABLE_REVENUE", "GUEST_NIGHTS", "TIME_SAVED_HOURS",
  "COST_PER_BOOKING", "AI_SEARCH_VISIBILITY", "REFERRAL_TRAFFIC", "GUEST_SATISFACTION", "TOTAL_BOOKINGS", "OTHER",
]);

const schema = z.object({
  title: f.str(),
  operatorId: f.optId(),
  initiativeId: f.optId(),
  opportunityId: f.optId(),
  supersedesId: f.optId(),
  changeFromPrevious: f.optStr(),
  isDestinationLevel: f.bool(),
  hypothesis: f.str(),
  problem: f.str(),
  audience: f.optStr(),
  intervention: f.str(),
  startDate: f.optDate(),
  endDate: f.optDate(),
  baselineStart: f.optDate(),
  baselineEnd: f.optDate(),
  comparisonMethod: z.enum(["BEFORE_AFTER", "CONTROL_GROUP", "MATCHED_COMPARISON", "NONE"]),
  primaryMetric: METRIC,
  primaryMetricLabel: f.optStr(),
  secondaryMetrics: f.list(),
  baselineValue: f.optNum(),
  targetValue: f.optNum(),
  minimumAcceptable: f.optNum(),
  higherIsBetter: f.bool(),
  maxCostNzd: f.optNum(),
  actualValue: f.optNum(),
  actualCostNzd: f.optNum(),
  controlValue: f.optNum(),
  resultSummary: f.optStr(),
  limitations: f.optStr(),
  attributionNotes: f.optStr(),
  incrementalVisitors: f.optNum(),
  incrementalGuestNights: f.optNum(),
  incrementalSpendNzd: f.optNum(),
  status: z.enum(["DESIGN", "RUNNING", "ANALYSING", "COMPLETE", "ABANDONED"]),
  decision: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["SCALE", "AMEND", "STOP", "INVESTIGATE"]).optional()),
  nextAction: f.optStr(),
  visibility: z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]),
});

function rules(d: z.infer<typeof schema>): string | null {
  if (!d.operatorId && !d.initiativeId && !d.isDestinationLevel) return "Link the experiment to an operator, a shared initiative, or mark it destination-level.";
  if (d.startDate && d.endDate && d.endDate < d.startDate) return "End date is before start date.";
  if (d.status !== "DESIGN" && d.status !== "ABANDONED" && d.minimumAcceptable == null && d.targetValue == null) {
    return "Set a target or minimum acceptable result before the experiment starts — not after seeing results.";
  }
  if (d.supersedesId && !d.changeFromPrevious) return "A re-run must say what is different from the earlier experiment.";
  if (d.status === "COMPLETE" && !d.limitations) return "Record the limitations before marking complete.";
  return null;
}

export async function createExperiment(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("experiments.edit");
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  const err = rules(parsed.data);
  if (err) return { error: err };
  let id = "";
  const res = await guarded(async () => {
    const e = await prisma.experiment.create({ data: nullify(parsed.data) as never });
    id = e.id;
    await audit(user.id, "create", "experiment", e.id, `Experiment: ${e.title}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  redirect(`/experiments/${id}`);
}

export async function updateExperiment(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("experiments.edit");
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  const err = rules(parsed.data);
  if (err) return { error: err };
  return guarded(async () => {
    const before = await prisma.experiment.findUniqueOrThrow({ where: { id } });
    // Thresholds are pre-registered: changing them after start is logged prominently.
    const data = nullify(parsed.data);
    const changes = diff(before, data);
    await prisma.experiment.update({ where: { id }, data: data as never });
    const movedGoalposts = before.status !== "DESIGN" && (before.targetValue !== data.targetValue || before.minimumAcceptable !== data.minimumAcceptable);
    await audit(user.id, movedGoalposts ? "threshold_change" : "update", "experiment", id, movedGoalposts ? "Target/minimum changed after experiment started" : "Experiment updated", changes);
    revalidatePath(`/experiments/${id}`);
    return { ok: movedGoalposts ? "Saved — note: changing thresholds after start is flagged in the audit log" : "Saved" };
  });
}
