import Link from "next/link";
import { ActionForm, Card, Checkbox, EmptyState, EvidenceBadge, FormGrid, IllustrativeBadge, Notice, PageHeader, Select, Table, TextArea, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { compareMeasurements } from "@/lib/domain/results";
import { EVIDENCE_LABELS, METRIC_LABELS, options } from "@/lib/labels";
import { formatDate, formatNum, pct } from "@/lib/format";
import { addMeasurement, importMeasurements } from "./actions";

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  await requirePermission("results.view");
  const op = (await searchParams).operator;
  const operatorId = typeof op === "string" ? op : undefined;
  const [operators, operatorOpts, experiments] = await Promise.all([
    prisma.operator.findMany({ where: operatorId ? { id: operatorId } : { status: { notIn: ["WITHDRAWN", "PROSPECT"] } }, orderBy: { name: "asc" }, include: { measurements: { orderBy: { periodEnd: "desc" } } } }),
    operatorOptions(),
    prisma.experiment.findMany({ where: operatorId ? { operatorId } : {}, select: { id: true, title: true } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Evidence" title="Baselines & results" description="Capture baselines in weeks 1–2 before changing anything. Every number records its source and what kind of evidence it is. A change from baseline is not, on its own, proof that an intervention caused it." />
      <div className="mb-6"><Notice tone="info">Manual entry and authorised CSV imports only. No operator systems are connected in phase 1.</Notice></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {operators.map((o) => {
            const comps = compareMeasurements(o.measurements);
            return (
              <Card key={o.id} title={<Link href={`/operators/${o.id}`} className="hover:underline">{o.name}</Link>} description={`${o.measurements.length} measurement${o.measurements.length === 1 ? "" : "s"}`} padded={false}>
                {comps.length === 0 ? <div className="p-5"><EmptyState title="No baseline yet" /></div> : (
                  <Table>
                    <thead><tr><th>Metric</th><th className="text-right">Baseline</th><th className="text-right">Latest result</th><th className="text-right">Change</th><th /></tr></thead>
                    <tbody>
                      {comps.map((c) => (
                        <tr key={c.key}>
                          <td>{c.label ?? METRIC_LABELS[c.metric]}<p className="text-xs text-subtle">{c.unit}</p></td>
                          <td className="text-right tabular-nums">{formatNum(c.baseline)}</td>
                          <td className="text-right tabular-nums">{formatNum(c.result)}</td>
                          <td className={`text-right tabular-nums ${c.improved === true ? "text-success" : c.improved === false ? "text-danger" : "text-muted"}`}>{c.change == null ? "—" : `${c.change > 0 ? "+" : ""}${formatNum(c.change)}${c.changePct != null ? ` (${pct(c.changePct)})` : ""}`}</td>
                          <td>{c.illustrative && <IllustrativeBadge />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
                {operatorId && o.measurements.length > 0 && (
                  <details className="border-t border-line p-5">
                    <summary className="cursor-pointer text-sm font-medium text-accent">All measurements</summary>
                    <Table className="mt-3">
                      <thead><tr><th>Metric</th><th>Kind</th><th className="text-right">Value</th><th>Period</th><th>Source</th><th>Evidence</th></tr></thead>
                      <tbody>{o.measurements.map((m) => <tr key={m.id}><td>{m.label ?? METRIC_LABELS[m.metric]}</td><td className="text-xs">{m.kind.toLowerCase()}</td><td className="text-right tabular-nums">{formatNum(m.value)} <span className="text-xs text-subtle">{m.unit}</span></td><td className="whitespace-nowrap text-xs text-muted">{formatDate(m.periodStart)} – {formatDate(m.periodEnd)}</td><td className="text-xs text-muted">{m.source}</td><td><EvidenceBadge k={m.evidenceKind} /></td></tr>)}</tbody>
                    </Table>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="Record a measurement">
            <ActionForm action={addMeasurement} submitLabel="Record" resetOnSuccess>
              <Select name="operatorId" label="Operator" required options={operatorOpts} defaultValue={operatorId} placeholder="Choose…" />
              <Select name="metric" label="Metric" required options={options(METRIC_LABELS)} placeholder="Choose…" />
              <TextField name="label" label="Metric detail (required for Other)" />
              <FormGrid>
                <Select name="kind" label="Kind" options={[{ value: "BASELINE", label: "Baseline" }, { value: "RESULT", label: "Result" }]} defaultValue="BASELINE" />
                <TextField name="value" label="Value" type="number" required />
                <TextField name="unit" label="Unit" required placeholder="per month, %, hours/week" />
                <Select name="evidenceKind" label="Evidence" options={options(EVIDENCE_LABELS)} defaultValue="OPERATOR_REPORTED" />
                <TextField name="periodStart" label="Period start" type="date" required />
                <TextField name="periodEnd" label="Period end" type="date" required />
              </FormGrid>
              <TextField name="source" label="Source" required placeholder="e.g. Rezdy export, GA4, owner estimate" />
              <Select name="experimentId" label="Linked experiment" options={experiments.map((e) => ({ value: e.id, label: e.title }))} placeholder="—" />
              <TextArea name="notes" label="Notes" rows={2} />
            </ActionForm>
          </Card>
          <Card title="Import from CSV" description="For exports the operator has authorised. All rows must be valid or nothing is imported.">
            <ActionForm action={importMeasurements} submitLabel="Import" resetOnSuccess>
              <Select name="operatorId" label="Operator" required options={operatorOpts} defaultValue={operatorId} placeholder="Choose…" />
              <TextArea name="csv" label="CSV" rows={6} placeholder={"metric,kind,value,unit,periodStart,periodEnd,source\nGUEST_NIGHTS,BASELINE,1840,nights/month,2026-08-01,2026-08-31,RMS export"} />
              <Checkbox name="authorised" label="The operator has authorised importing this data for the agreed purpose" />
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
