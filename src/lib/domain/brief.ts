// Weekly Growth Brief (Scan → Brief → Learn), ported from the Tourism Growth
// Intelligence daily-brief builder. Pure function over already-stored data:
// it never invents a signal, number or action. Gaps are stated, not filled.
// A shared brief is read by the business itself, so its wording addresses
// them, and its input must only contain items they can already see.

import type { ClaimType, ConfidenceLevel, Horizon, WorkStatus } from "@/generated/prisma";
import { priorityScore } from "./prioritise";

export interface BriefInput {
  weekOf: Date;
  signals: { id: string; title: string; claimType: ClaimType; source: string; sourceTimestamp: Date; confidence: ConfidenceLevel; isIllustrative: boolean }[];
  opportunities: { id: string; title: string; problem: string; proposedSolution: string; impactScore: number; effortScore: number; confidence: ConfidenceLevel; horizon: Horizon; status: string; successMetric: string | null }[];
  tasks: { title: string; status: WorkStatus; dueDate: Date | null; ownerLabel: string | null; assigneeName: string | null; requiresApproval: boolean }[];
  experiments: { title: string; status: string; resultSummary: string | null; decision: string | null }[];
  hasBaseline: boolean;
}

export interface BriefAction {
  action: string;
  why: string;
  owner: string;
  effort: "S" | "M" | "L";
  measure: string;
  needsApproval: boolean;
}

export interface BriefDraft {
  whatChanged: { text: string; claimType: ClaimType; source: string; signalId: string; illustrative: boolean }[];
  whyItMatters: string | null;
  actions: BriefAction[];
  learnings: string | null;
  dataGaps: string[];
}

const DAY = 86_400_000;
const ACTIVE_OPP = ["IDENTIFIED", "PRIORITISED", "APPROVED", "IN_PROGRESS"];

export function buildBrief(input: BriefInput, maxActions = 3): BriefDraft {
  const since = input.weekOf.getTime() - 14 * DAY;
  const recent = input.signals
    .filter((s) => s.sourceTimestamp.getTime() >= since)
    .sort((a, b) => b.sourceTimestamp.getTime() - a.sourceTimestamp.getTime())
    .slice(0, 6);

  const dataGaps: string[] = [];
  if (recent.length === 0) dataGaps.push("No new updates in the last 14 days. Send us this week's enquiries or reviews and the next brief will include them.");
  if (!input.hasBaseline) dataGaps.push("No baseline measurement recorded — results cannot be compared yet.");

  const candidates = input.opportunities
    .filter((o) => ACTIVE_OPP.includes(o.status) && o.horizon === "NOW")
    .sort((a, b) => priorityScore(b) - priorityScore(a));
  const top = candidates[0];

  const actions: BriefAction[] = [];
  // 1. Overdue / blocked tasks first — finishing beats starting.
  for (const t of input.tasks) {
    if (actions.length >= maxActions) break;
    const overdue = t.dueDate && t.dueDate.getTime() < input.weekOf.getTime() && t.status !== "DONE" && t.status !== "CANCELLED";
    if (t.status === "BLOCKED" || overdue) {
      actions.push({
        action: `${t.status === "BLOCKED" ? "Unblock" : "Complete"}: ${t.title}`,
        why: t.status === "BLOCKED" ? "Blocked work is holding up an implementation." : "This task is overdue.",
        owner: t.assigneeName ?? t.ownerLabel ?? "To be agreed",
        effort: "S",
        measure: "Task marked done",
        needsApproval: t.requiresApproval,
      });
    }
  }
  // 2. Highest-priority NOW opportunities.
  for (const o of candidates) {
    if (actions.length >= maxActions) break;
    actions.push({
      action: o.status === "APPROVED" || o.status === "IN_PROGRESS" ? `Progress: ${o.title}` : `Decide together whether to start: ${o.title}`,
      why: o.problem,
      owner: "To be agreed with you",
      effort: o.effortScore <= 2 ? "S" : o.effortScore >= 4 ? "L" : "M",
      measure: o.successMetric ?? "Define a success metric before starting",
      needsApproval: true,
    });
  }
  if (actions.length === 0) dataGaps.push("No priority actions this week. We'll review your plan with you.");

  const done = input.experiments.filter((e) => e.status === "COMPLETE" || e.status === "ANALYSING");
  const learnings = done.length
    ? done
        .map((e) => `${e.title}: ${e.resultSummary ?? "result not yet written up"}${e.decision ? ` → decision: ${e.decision}` : " → no decision recorded yet"}`)
        .join("\n")
    : null;
  if (!learnings) dataGaps.push("No completed experiments yet — nothing to learn from formally this week.");

  return {
    whatChanged: recent.map((s) => ({ text: s.title, claimType: s.claimType, source: s.source, signalId: s.id, illustrative: s.isIllustrative })),
    whyItMatters: top ? `${top.title}: ${top.problem}` : null,
    actions,
    learnings,
    dataGaps,
  };
}
