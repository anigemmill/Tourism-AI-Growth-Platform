import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionForm, ButtonLink, Card, ConfidenceBadge, DecisionBadge, DefinitionList, EvidenceBadge, ExperimentStatusBadge, HorizonBadge,
  OppStatusBadge, PageHeader, Select, TextArea, VisibilityBadge, WorkStatusBadge,
} from "@/components/ui";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { initiativeOptions, operatorOptions, staffOptions } from "@/lib/queries";
import { priorityBand, priorityScore } from "@/lib/domain/prioritise";
import { AREA_LABELS, DECISION_LABELS, SOLUTION_LABELS, options } from "@/lib/labels";
import { formatNzd } from "@/lib/format";
import { convertToProject, recordDecision, updateOpportunity } from "../actions";
import { OpportunityForm } from "../OpportunityForm";

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  await requirePermission("opportunities.view");
  const { id } = await params;
  const o = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      operator: { select: { id: true, name: true } },
      initiative: { select: { id: true, title: true } },
      template: { select: { name: true } },
      owner: { select: { name: true } },
      projects: true,
      experiments: true,
      signals: { select: { id: true, title: true, claimType: true } },
    },
  });
  if (!o) notFound();
  const [operatorOpts, initiativeOpts, staffOpts, templates] = await Promise.all([
    operatorOptions(), initiativeOptions(), staffOptions(),
    prisma.solutionTemplate.findMany({ select: { id: true, name: true } }),
  ]);
  const score = priorityScore(o);

  return (
    <div>
      <PageHeader
        eyebrow={o.operator ? <Link href={`/operators/${o.operator.id}`} className="hover:underline">{o.operator.name}</Link> : o.initiative ? <Link href={`/collective/initiatives/${o.initiative.id}`} className="hover:underline">{o.initiative.title}</Link> : "Opportunity"}
        title={o.title}
        description={
          <span className="flex flex-wrap gap-1.5">
            <HorizonBadge h={o.horizon} /><OppStatusBadge s={o.status} /><EvidenceBadge k={o.evidenceBasis} /><ConfidenceBadge c={o.confidence} /><VisibilityBadge v={o.visibility} /><DecisionBadge d={o.decision} />
          </span>
        }
        actions={
          <>
            <ActionForm action={convertToProject.bind(null, o.id)} submitLabel="Convert to project" variant="secondary" />
            <ButtonLink href={`/experiments/new?opportunityId=${o.id}${o.operatorId ? `&operatorId=${o.operatorId}` : ""}${o.initiativeId ? `&initiativeId=${o.initiativeId}` : ""}`}>Design experiment</ButtonLink>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Summary">
            <DefinitionList
              items={[
                { label: "Area", value: AREA_LABELS[o.area] },
                { label: "Solution type", value: SOLUTION_LABELS[o.solutionType] },
                { label: "Priority score", value: `${score} (${priorityBand(score)}) — impact ${o.impactScore}/5, effort ${o.effortScore}/5, ${o.confidence.toLowerCase()} confidence` },
                { label: "Owner", value: o.owner?.name },
                { label: "Problem", value: o.problem },
                { label: "Current process", value: o.currentProcess },
                { label: "Proposed improvement", value: o.proposedSolution },
                { label: "Expected value", value: [o.expectedValue, o.expectedValueNzd != null && `${formatNzd(o.expectedValueNzd)}/yr (estimate)`].filter(Boolean).join(" — ") },
                { label: "Cost", value: `${formatNzd(o.oneOffCostNzd)} one-off · ${formatNzd(o.monthlyCostNzd)}/month · ${o.effortHours ?? "—"} h` },
                { label: "Tools", value: o.tools.join(", ") },
                { label: "Data requirements", value: o.dataRequirements },
                { label: "Risks", value: o.risks },
                { label: "Dependencies", value: o.dependencies },
                { label: "Success metric", value: o.successMetric },
                { label: "Baseline → target", value: [o.baselineMetric, o.targetMetric].filter(Boolean).join(" → ") },
                { label: "Actual result", value: o.actualResult },
                { label: "Template", value: o.template?.name },
              ]}
            />
          </Card>
          <Card title="Decision" description="Scale, amend, stop or investigate — record why.">
            <ActionForm action={recordDecision.bind(null, o.id)} submitLabel="Record decision">
              <Select name="decision" label="Decision" options={options(DECISION_LABELS)} defaultValue={o.decision} placeholder="No decision yet" />
              <TextArea name="actualResult" label="Actual result" defaultValue={o.actualResult} rows={2} />
              <TextArea name="decisionNotes" label="Rationale" defaultValue={o.decisionNotes} rows={3} />
            </ActionForm>
          </Card>
          <details className="rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Edit opportunity</summary>
            <div className="border-t border-line p-5">
              <OpportunityForm action={updateOpportunity.bind(null, o.id)} o={o} operatorOpts={operatorOpts} initiativeOpts={initiativeOpts} staffOpts={staffOpts} templateOpts={templates.map((t) => ({ value: t.id, label: t.name }))} submitLabel="Save changes" />
            </div>
          </details>
        </div>
        <div className="space-y-6">
          <Card title="Delivery">
            <p className="text-xs font-medium text-muted">Projects</p>
            {o.projects.length === 0 ? <p className="text-sm text-subtle">None</p> : (
              <ul className="mt-1 space-y-1 text-sm">{o.projects.map((p) => <li key={p.id} className="flex justify-between gap-2"><Link href={`/work/projects/${p.id}`} className="hover:underline">{p.title}</Link><WorkStatusBadge s={p.status} /></li>)}</ul>
            )}
            <p className="mt-4 text-xs font-medium text-muted">Experiments</p>
            {o.experiments.length === 0 ? <p className="text-sm text-subtle">None</p> : (
              <ul className="mt-1 space-y-1 text-sm">{o.experiments.map((e) => <li key={e.id} className="flex justify-between gap-2"><Link href={`/experiments/${e.id}`} className="hover:underline">{e.title}</Link><ExperimentStatusBadge s={e.status} /></li>)}</ul>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">Create a task</summary>
              <div className="mt-3"><TaskQuickAdd operatorId={o.operatorId ?? undefined} initiativeId={o.initiativeId ?? undefined} staffOpts={staffOpts} /></div>
            </details>
          </Card>
          <EvidencePanel entityType="opportunity" entityId={o.id} operatorId={o.operatorId} path={`/opportunities/${o.id}`} />
        </div>
      </div>
    </div>
  );
}
