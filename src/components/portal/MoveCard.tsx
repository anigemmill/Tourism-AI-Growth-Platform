// One roadmap item in the wireframe "move" style: number, title, why, and
// chips for where/effort/impact. Read-only.

import type { Horizon, OpportunityStatus, SolutionType } from "@/generated/prisma";
import { Badge, OppStatusBadge, cx } from "@/components/ui";
import { SOLUTION_LABELS } from "@/lib/labels";

export interface Move {
  id: string;
  title: string;
  problem: string;
  proposedSolution?: string | null;
  solutionType: SolutionType;
  impactScore: number;
  effortScore: number;
  effortHours: number | null;
  horizon: Horizon;
  status: OpportunityStatus;
}

export function impactLabel(score: number) {
  return score >= 4 ? "High" : score >= 3 ? "Med" : "Low";
}

function effortLabel(m: Move) {
  if (m.effortHours) return m.effortHours === 1 ? "1 hr" : `${m.effortHours} hrs`;
  return m.effortScore <= 2 ? "Quick" : m.effortScore >= 4 ? "Bigger job" : "Moderate";
}

/** Live, being measured or closed counts as done for the operator's plan. */
export function isDone(status: OpportunityStatus) {
  return status === "LIVE" || status === "MEASURING" || status === "CLOSED";
}

export function MoveCard({ move, index, detailed = false }: { move: Move; index?: number; detailed?: boolean }) {
  const done = isDone(move.status);
  const high = move.impactScore >= 4;
  return (
    <div className={cx("flex gap-4 rounded-xl border border-line bg-surface p-4", done && "opacity-70")}>
      {index !== undefined && <span className="font-display w-6 shrink-0 text-2xl leading-none text-ink">{index}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={cx("text-[15px] font-semibold text-ink", done && "line-through decoration-1")}>{move.title}</p>
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={high ? "accent" : "outline"}>{impactLabel(move.impactScore)} impact · {effortLabel(move)}</Badge>
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{move.problem}</p>
        {detailed && move.proposedSolution && <p className="mt-2 text-sm text-ink">{move.proposedSolution}</p>}
        {detailed && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="eyebrow text-subtle">{SOLUTION_LABELS[move.solutionType]}</span>
            <OppStatusBadge s={move.status} />
          </div>
        )}
      </div>
    </div>
  );
}
