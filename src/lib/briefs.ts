// Input for a business's weekly brief. A shared brief is shown to the
// business, so only items the business can already see go in: staff-only
// (INTERNAL) signals, plan items and experiments never do.
//
// No Next.js request APIs here, so integration tests call it directly.

import { prisma } from "@/lib/prisma";
import type { BriefInput } from "@/lib/domain/brief";

const CLIENT_VISIBLE = { visibility: { not: "INTERNAL" as const } };

export async function briefInputFor(operatorId: string, weekOf: Date): Promise<BriefInput> {
  const [signals, opportunities, tasks, experiments, baselineCount] = await Promise.all([
    prisma.signal.findMany({ where: { operatorId, ...CLIENT_VISIBLE } }),
    prisma.opportunity.findMany({ where: { operatorId, ...CLIENT_VISIBLE } }),
    prisma.task.findMany({ where: { operatorId, ...CLIENT_VISIBLE }, include: { assignee: { select: { name: true } } } }),
    prisma.experiment.findMany({ where: { operatorId, ...CLIENT_VISIBLE } }),
    prisma.measurement.count({ where: { operatorId, kind: "BASELINE" } }),
  ]);
  return {
    weekOf,
    signals,
    opportunities,
    tasks: tasks.map((t) => ({ ...t, assigneeName: t.assignee?.name ?? null })),
    experiments,
    hasBaseline: baselineCount > 0,
  };
}
