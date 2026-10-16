// Publishing plan items to the client. Staff draft opportunities, projects,
// tasks and experiments as staff-only (INTERNAL), then show each one to the
// business (CONFIDENTIAL = this business + staff) when it's ready, or hide it
// again. Wider sharing (cohort, aggregate, public) needs the consent checks in
// the full edit forms, so this switch only ever moves between those two values.
//
// No Next.js request APIs here, so integration tests call it directly.

import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/generated/prisma";
import type { Permission } from "@/lib/rbac/permissions";
import { audit } from "@/lib/audit";

export const PLAN_KINDS = ["opportunity", "project", "task", "experiment"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

const PERMISSION: Record<PlanKind, Permission> = {
  opportunity: "opportunities.edit",
  project: "work.edit",
  task: "work.edit",
  experiment: "experiments.edit",
};

export interface PlanActor {
  id: string;
  permissions: readonly string[];
}

export type PlanVisibilityResult = { ok: true; message: string } | { ok: false; error: string };

type Row = { id: string; title: string; operatorId: string | null; visibility: Visibility };

async function load(kind: PlanKind, id: string): Promise<Row | null> {
  const select = { id: true, title: true, operatorId: true, visibility: true } as const;
  switch (kind) {
    case "opportunity": return prisma.opportunity.findUnique({ where: { id }, select });
    case "project": return prisma.project.findUnique({ where: { id }, select });
    case "task": return prisma.task.findUnique({ where: { id }, select });
    case "experiment": return prisma.experiment.findUnique({ where: { id }, select });
  }
}

async function save(kind: PlanKind, id: string, visibility: Visibility) {
  const data = { visibility };
  switch (kind) {
    case "opportunity": return prisma.opportunity.update({ where: { id }, data });
    case "project": return prisma.project.update({ where: { id }, data });
    case "task": return prisma.task.update({ where: { id }, data });
    case "experiment": return prisma.experiment.update({ where: { id }, data });
  }
}

/** Whether the business can see this item in its portal. */
export function visibleToClient(visibility: Visibility): boolean {
  return visibility !== "INTERNAL";
}

export async function setClientVisibility(actor: PlanActor, kind: PlanKind, id: string, visible: boolean): Promise<PlanVisibilityResult> {
  if (!PLAN_KINDS.includes(kind)) return { ok: false, error: "Unknown item type." };
  if (!actor.permissions.includes(PERMISSION[kind])) return { ok: false, error: "You don't have permission to do that." };
  const row = await load(kind, id);
  if (!row) return { ok: false, error: "That item no longer exists." };
  if (!row.operatorId) return { ok: false, error: "Only items for a specific business can be shown to a client." };
  if (row.visibility !== "INTERNAL" && row.visibility !== "CONFIDENTIAL") {
    return { ok: false, error: "This item is shared beyond the business. Change its sharing in the edit form." };
  }
  const target: Visibility = visible ? "CONFIDENTIAL" : "INTERNAL";
  if (row.visibility === target) return { ok: true, message: visible ? "Already shown to the client." : "Already staff only." };
  await save(kind, id, target);
  await audit(actor.id, visible ? "plan.show_to_client" : "plan.hide_from_client", kind, id,
    `${visible ? "Showed" : "Hid"} ${kind} "${row.title}" ${visible ? "to" : "from"} the client`,
    { visibility: { from: row.visibility, to: target }, operatorId: row.operatorId });
  return { ok: true, message: visible ? "Now shown to the client." : "Hidden from the client." };
}
