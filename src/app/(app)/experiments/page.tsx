import Link from "next/link";
import { Badge, ButtonLink, Card, DecisionBadge, EmptyState, ExperimentStatusBadge, IllustrativeBadge, PageHeader, Table } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { evaluateExperiment, VERDICT_LABELS } from "@/lib/domain/experiments";
import { COMPARISON_LABELS, METRIC_LABELS } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";

export default async function ExperimentsPage() {
  await requirePermission("experiments.view");
  const rows = await prisma.experiment.findMany({ orderBy: [{ status: "asc" }, { startDate: "asc" }], include: { operator: { select: { name: true } }, initiative: { select: { title: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Evidence" title="Experiments" description="Every experiment has a hypothesis, baseline, comparison method and pre-set thresholds. Verdicts are mechanical and always come with caveats." actions={<ButtonLink href="/experiments/new" variant="primary">New experiment</ButtonLink>} />
      {rows.length === 0 ? <EmptyState title="No experiments yet" /> : (
        <Card padded={false}>
          <Table>
            <thead><tr><th>Experiment</th><th>For</th><th>Metric</th><th>Method</th><th>Dates</th><th>Status</th><th>Verdict</th><th>Decision</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const ev = evaluateExperiment({ ...e, hasIllustrativeData: e.isIllustrative });
                return (
                  <tr key={e.id}>
                    <td className="min-w-[16rem]"><Link href={`/experiments/${e.id}`} className="font-medium hover:underline">{e.title}</Link><p className="line-clamp-2 text-xs text-muted">{e.hypothesis}</p>{e.isIllustrative && <IllustrativeBadge />}</td>
                    <td className="text-muted">{e.operator?.name ?? e.initiative?.title ?? (e.isDestinationLevel ? "Destination" : "—")}</td>
                    <td className="text-xs text-muted">{e.primaryMetricLabel ?? METRIC_LABELS[e.primaryMetric]}</td>
                    <td className="text-xs text-muted">{COMPARISON_LABELS[e.comparisonMethod]}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{formatShortDate(e.startDate)} – {formatShortDate(e.endDate)}</td>
                    <td><ExperimentStatusBadge s={e.status} /></td>
                    <td>{["ANALYSING", "COMPLETE"].includes(e.status) ? <Badge tone={ev.verdict === "target_met" ? "success" : ev.verdict === "minimum_met" ? "info" : ev.verdict === "insufficient_data" ? "outline" : "danger"}>{VERDICT_LABELS[ev.verdict]}</Badge> : <span className="text-xs text-subtle">—</span>}</td>
                    <td><DecisionBadge d={e.decision} /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
