import "server-only";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/rbac/permissions";

// Entities available for export. Credentials, session tokens and password
// hashes are never exported.
export const EXPORTS = {
  operators: { label: "Operators", load: () => prisma.operator.findMany({ orderBy: { name: "asc" } }) },
  assessments: { label: "Assessment area scores", load: () => prisma.assessmentAreaScore.findMany({ include: { assessment: { select: { operatorId: true, status: true, conductedAt: true } } } }).then((r) => r.map(({ assessment, ...x }) => ({ ...x, operatorId: assessment.operatorId, assessmentStatus: assessment.status, conductedAt: assessment.conductedAt }))) },
  opportunities: { label: "Opportunity register", load: () => prisma.opportunity.findMany() },
  projects: { label: "Projects", load: () => prisma.project.findMany() },
  tasks: { label: "Tasks", load: () => prisma.task.findMany() },
  experiments: { label: "Experiments", load: () => prisma.experiment.findMany() },
  measurements: { label: "Measurements (baselines & results)", load: () => prisma.measurement.findMany() },
  evidence: { label: "Evidence", load: () => prisma.evidence.findMany() },
  signals: { label: "Growth Intelligence signals", load: () => prisma.signal.findMany() },
  briefs: { label: "Weekly growth briefs", load: () => prisma.growthBrief.findMany() },
  workshops: { label: "Workshops", load: () => prisma.workshop.findMany() },
  attendance: { label: "Workshop attendance", load: () => prisma.workshopAttendance.findMany() },
  learnings: { label: "Learnings", load: () => prisma.learning.findMany() },
  resources: { label: "Resources", load: () => prisma.resource.findMany() },
  initiatives: { label: "Shared initiatives", load: () => prisma.sharedInitiative.findMany() },
  participants: { label: "Initiative participants", load: () => prisma.initiativeParticipant.findMany() },
  workflows: { label: "Agent & workflow library", load: () => prisma.workflowAsset.findMany() },
  workflowVersions: { label: "Workflow versions", load: () => prisma.workflowVersion.findMany() },
  templates: { label: "Solution templates", load: () => prisma.solutionTemplate.findMany() },
  risks: { label: "Risks", load: () => prisma.risk.findMany() },
  decisions: { label: "Decisions", load: () => prisma.decisionRecord.findMany() },
  programme: { label: "Programme, stages & milestones", load: () => prisma.programme.findMany({ include: { stages: true, milestones: true } }) },
  deals: { label: "Deals", permission: "commercial.view" as Permission, load: () => prisma.deal.findMany() },
  payments: { label: "Payments", permission: "commercial.view" as Permission, load: () => prisma.payment.findMany() },
  costs: { label: "Costs", permission: "commercial.view" as Permission, load: () => prisma.costItem.findMany() },
  scenarios: { label: "Pricing scenarios", permission: "commercial.view" as Permission, load: () => prisma.pricingScenario.findMany() },
  users: { label: "Users (no credentials)", permission: "users.view" as Permission, load: () => prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, operatorId: true, status: true, lastLoginAt: true, createdAt: true } }) },
  audit: { label: "Audit log", permission: "audit.view" as Permission, load: () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } }) },
} as const;

export type ExportKey = keyof typeof EXPORTS;

/** Extra permission (beyond data.export) needed for a dataset, if any. */
export function exportPermission(k: ExportKey): Permission | null {
  const def = EXPORTS[k];
  return "permission" in def ? def.permission : null;
}

export function exportableKeys(perms: readonly string[]): ExportKey[] {
  return (Object.keys(EXPORTS) as ExportKey[]).filter((k) => {
    const p = exportPermission(k);
    return !p || perms.includes(p);
  });
}
