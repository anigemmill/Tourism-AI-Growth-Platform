import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, DecisionBadge, ExperimentStatusBadge, IllustrativeBadge, Notice, PageHeader, Stat, Table, VisibilityBadge } from "@/components/ui";
import { EvidencePanel } from "@/components/EvidencePanel";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { initiativeOptions, operatorOptions } from "@/lib/queries";
import { opportunityOptions } from "@/lib/opportunityOptions";
import { experimentOptions } from "@/lib/experimentOptions";
import { evaluateExperiment, VERDICT_LABELS } from "@/lib/domain/experiments";
import { COMPARISON_LABELS, METRIC_LABELS } from "@/lib/labels";
import { formatDate, formatNum, formatNzd, pct } from "@/lib/format";
import { updateExperiment } from "../actions";
import { ExperimentForm } from "../ExperimentForm";

export default async function ExperimentPage({ params }: PageProps<"/experiments/[id]">) {
  await requirePermission("experiments.view");
  const { id } = await params;
  const e = await prisma.experiment.findUnique({
    where: { id },
    include: { operator: { select: { id: true, name: true } }, initiative: { select: { id: true, title: true } }, opportunity: { select: { id: true, title: true } }, measurements: { orderBy: { periodEnd: "asc" } } },
  });
  if (!e) notFound();
  const [operatorOpts, initiativeOpts, opportunityOpts, experimentOpts, previous] = await Promise.all([
    operatorOptions(), initiativeOptions(), opportunityOptions(), experimentOptions(e.id),
    e.supersedesId ? prisma.experiment.findUnique({ where: { id: e.supersedesId }, select: { id: true, title: true } }) : null,
  ]);
  const illustrative = e.isIllustrative || e.measurements.some((m) => m.isIllustrative);
  const ev = evaluateExperiment({ ...e, hasIllustrativeData: illustrative });

  return (
    <div>
      <PageHeader
        eyebrow={e.operator ? <Link href={`/operators/${e.operator.id}`} className="hover:underline">{e.operator.name}</Link> : e.initiative ? <Link href={`/collective/initiatives/${e.initiative.id}`} className="hover:underline">{e.initiative.title}</Link> : "Experiment"}
        title={e.title}
        description={<span className="flex flex-wrap gap-1.5"><ExperimentStatusBadge s={e.status} /><DecisionBadge d={e.decision} /><VisibilityBadge v={e.visibility} />{illustrative && <IllustrativeBadge />}</span>}
        actions={<ButtonLink href={`/reports/experiment/${e.id}`}>Experiment report</ButtonLink>}
      />
      <Card className="mb-6" title="Hypothesis">
        <p className="text-sm">{e.hypothesis}</p>
        <p className="mt-2 text-xs text-muted">Method: {COMPARISON_LABELS[e.comparisonMethod]} · Metric: {e.primaryMetricLabel ?? METRIC_LABELS[e.primaryMetric]} ({e.higherIsBetter ? "higher" : "lower"} is better)
          {e.opportunity && <> · Tests <Link href={`/opportunities/${e.opportunity.id}`} className="text-accent hover:underline">{e.opportunity.title}</Link></>}
          {previous && <> · Re-run of <Link href={`/experiments/${previous.id}`} className="text-accent hover:underline">{previous.title}</Link></>}
        </p>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Baseline" value={formatNum(e.baselineValue)} sub={`${formatDate(e.baselineStart)} – ${formatDate(e.baselineEnd)}`} />
        <Stat label="Minimum acceptable" value={formatNum(e.minimumAcceptable)} />
        <Stat label="Target" value={formatNum(e.targetValue)} />
        <Stat label="Actual" value={formatNum(e.actualValue)} sub={ev.change != null ? `${ev.change > 0 ? "+" : ""}${formatNum(ev.change)}${ev.changePct != null ? ` (${pct(ev.changePct)})` : ""}` : undefined} />
        <Stat label="Cost vs max" value={formatNzd(e.actualCostNzd)} sub={`max ${formatNzd(e.maxCostNzd)}`} tone={e.actualCostNzd != null && e.maxCostNzd != null && e.actualCostNzd > e.maxCostNzd ? "danger" : "default"} />
      </div>
      <Card className="mb-6" title="Evaluation" description="Mechanical comparison against the thresholds set in advance.">
        <p className="mb-3"><Badge tone={ev.verdict === "target_met" ? "success" : ev.verdict === "minimum_met" ? "info" : ev.verdict === "insufficient_data" ? "outline" : "danger"}>{VERDICT_LABELS[ev.verdict]}</Badge>{ev.netOfControl != null && <span className="ml-2 text-sm text-muted">Difference vs control: {formatNum(ev.netOfControl)}</span>}</p>
        <Notice tone="warning">
          <ul className="list-disc space-y-0.5 pl-4">{ev.caveats.map((c) => <li key={c}>{c}</li>)}{e.attributionNotes && <li>{e.attributionNotes}</li>}</ul>
        </Notice>
        {e.isDestinationLevel && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Incremental visitors" value={formatNum(e.incrementalVisitors)} />
            <Stat label="Incremental guest nights" value={formatNum(e.incrementalGuestNights)} />
            <Stat label="Incremental local spend" value={formatNzd(e.incrementalSpendNzd)} />
          </div>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <details className="rounded-xl border border-line bg-surface" open={e.status === "DESIGN"}>
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Edit design, results & decision</summary>
            <div className="border-t border-line p-5">
              <ExperimentForm action={updateExperiment.bind(null, e.id)} e={e} operatorOpts={operatorOpts} initiativeOpts={initiativeOpts} opportunityOpts={opportunityOpts} experimentOpts={experimentOpts} submitLabel="Save experiment" />
            </div>
          </details>
        </div>
        <div className="space-y-6">
          <Card title="Linked measurements" padded={false}>
            {e.measurements.length === 0 ? <p className="p-5 text-sm text-muted">Link measurements from Baselines & results.</p> : (
              <Table><tbody>{e.measurements.map((m) => <tr key={m.id}><td className="text-xs">{m.kind.toLowerCase()}</td><td className="tabular-nums">{formatNum(m.value)} <span className="text-xs text-subtle">{m.unit}</span></td><td className="text-xs text-muted">{formatDate(m.periodEnd)}</td></tr>)}</tbody></Table>
            )}
          </Card>
          <EvidencePanel entityType="experiment" entityId={e.id} operatorId={e.operatorId} path={`/experiments/${e.id}`} />
        </div>
      </div>
    </div>
  );
}
