import Link from "next/link";
import type { PricingScenario } from "@/generated/prisma";
import { ActionForm, Badge, ButtonLink, Card, Checkbox, DealStageBadge, EmptyState, FormGrid, IllustrativeBadge, Notice, PageHeader, Select, Stat, Table, Tabs, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { dealValue, runScenario, summarise } from "@/lib/domain/commercial";
import { COST_LABELS, DEAL_TYPE_LABELS, options } from "@/lib/labels";
import { formatDate, formatNzd, pct } from "@/lib/format";
import { addCost, createDeal, deleteScenario, saveScenario } from "./actions";
import { DealFields } from "./DealFields";

const TABS = ["pipeline", "costs", "scenarios"] as const;

export default async function CommercialPage({ searchParams }: PageProps<"/commercial">) {
  await requirePermission("commercial.view");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t === requested) ?? "pipeline";
  const [deals, costs] = await Promise.all([
    prisma.deal.findMany({ include: { payments: true, operator: { select: { name: true } } }, orderBy: [{ stage: "asc" }, { updatedAt: "desc" }] }),
    prisma.costItem.findMany({ orderBy: { incurredAt: "desc" }, include: { deal: { select: { title: true } } } }),
  ]);
  const s = summarise(deals, costs, 3);
  const illustrative = deals.some((d) => d.isIllustrative) || costs.some((c) => c.isIllustrative);

  return (
    <div>
      <PageHeader eyebrow="Business" title="Commercial" description="Planning, not accounting. NZD excluding GST. Proposed, quoted, contracted and received revenue are always reported separately; forecasts are never counted as revenue." actions={<ButtonLink href="/reports/commercial">Commercial summary</ButtonLink>} />
      {illustrative && <div className="mb-6"><Notice tone="warning">Includes illustrative demo deals and costs. Replace with real figures before relying on any number here.</Notice></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Received" value={formatNzd(s.received)} tone="success" />
        <Stat label="Contracted" value={formatNzd(s.contracted)} sub={`${formatNzd(s.contractedOutstanding)} outstanding`} />
        <Stat label="Quoted" value={formatNzd(s.byStage.QUOTED)} />
        <Stat label="Proposed" value={formatNzd(s.byStage.PROPOSED)} />
        <Stat label="Weighted pipeline" value={formatNzd(s.weightedPipeline)} sub="forecast only" />
        <Stat label="Costs to date" value={formatNzd(s.actualCosts)} sub={`${formatNzd(s.forecastCosts)} forecast`} />
        <Stat label="Margin on received" value={s.grossMarginOnReceived == null ? "—" : pct(s.grossMarginOnReceived)} tone={s.grossMarginOnReceived != null && s.grossMarginOnReceived < 0.3 ? "warning" : "default"} />
      </div>
      <Tabs current={`/commercial?tab=${tab}`} tabs={[{ href: "/commercial?tab=pipeline", label: "Pipeline & contracts" }, { href: "/commercial?tab=costs", label: "Delivery & software costs" }, { href: "/commercial?tab=scenarios", label: "Pricing & cohort scenarios" }]} />

      {tab === "pipeline" && (
        <div className="space-y-6">
          <Card padded={false}>
            {deals.length === 0 ? <div className="p-5"><EmptyState title="No deals yet" /></div> : (
              <Table>
                <thead><tr><th>Deal</th><th>Type</th><th>Stage</th><th className="text-right">Contract value</th><th className="text-right">Monthly</th><th className="text-right">Prob.</th><th className="text-right">Received</th><th>Renewal</th></tr></thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id}>
                      <td><Link href={`/commercial/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link><p className="text-xs text-muted">{d.organisation}</p>{d.isIllustrative && <IllustrativeBadge />}</td>
                      <td className="text-xs text-muted">{DEAL_TYPE_LABELS[d.type]}</td>
                      <td><DealStageBadge s={d.stage} /></td>
                      <td className="text-right tabular-nums">{formatNzd(dealValue(d))}</td>
                      <td className="text-right tabular-nums">{d.monthlyValueNzd ? formatNzd(d.monthlyValueNzd) : "—"}</td>
                      <td className="text-right tabular-nums text-muted">{d.stage === "CONTRACTED" ? "—" : `${d.probability}%`}</td>
                      <td className="text-right tabular-nums">{formatNzd(d.payments.reduce((x, p) => x + p.amountNzd, 0))}</td>
                      <td className="text-xs text-muted">{formatDate(d.renewalDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title="Add deal or proposal"><ActionForm action={createDeal} submitLabel="Add deal" resetOnSuccess><DealFields operatorOpts={await operatorOptions()} /></ActionForm></Card>
        </div>
      )}

      {tab === "costs" && (
        <div className="space-y-6">
          <Card padded={false}>
            {costs.length === 0 ? <div className="p-5"><EmptyState title="No costs recorded" /></div> : (
              <Table>
                <thead><tr><th>Cost</th><th>Category</th><th>Date</th><th className="text-right">Amount</th><th /></tr></thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.id}>
                      <td>{c.description}{c.deal && <p className="text-xs text-muted">{c.deal.title}</p>}</td>
                      <td className="text-xs text-muted">{COST_LABELS[c.category]}</td>
                      <td className="text-xs text-muted">{formatDate(c.incurredAt)}</td>
                      <td className="text-right tabular-nums">{formatNzd(c.amountNzd)}{c.isMonthly ? "/mo" : ""}</td>
                      <td className="space-x-1">{c.isForecast && <Badge tone="info">Forecast</Badge>}{c.isIllustrative && <IllustrativeBadge />}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title="Record a cost">
            <ActionForm action={addCost} submitLabel="Add cost" resetOnSuccess>
              <FormGrid cols={3}>
                <TextField name="description" label="Description" required className="sm:col-span-2" />
                <Select name="category" label="Category" options={options(COST_LABELS)} defaultValue="DELIVERY_LABOUR" />
                <TextField name="amountNzd" label="Amount (NZD)" type="number" required />
                <TextField name="incurredAt" label="Date" type="date" required />
                <Select name="dealId" label="Linked deal" options={deals.map((d) => ({ value: d.id, label: d.title }))} placeholder="—" />
              </FormGrid>
              <div className="flex flex-wrap gap-6"><Checkbox name="isMonthly" label="Recurring monthly" /><Checkbox name="isForecast" label="Forecast (not yet incurred)" /></div>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "scenarios" && <Scenarios />}
    </div>
  );
}

async function Scenarios() {
  const scenarios = await prisma.pricingScenario.findMany({ orderBy: { createdAt: "asc" } });
  const results = scenarios.map((s) => ({ s, r: runScenario(s) }));
  const rows: [string, (x: (typeof results)[number]) => string][] = [
    ["Cohort size", ({ s }) => String(s.cohortSize)],
    ["Fee per operator", ({ s }) => formatNzd(s.feePerOperatorNzd)],
    ["Participation revenue", ({ r }) => formatNzd(r.participationRevenue)],
    ["Sponsorship", ({ r }) => formatNzd(r.sponsorship)],
    ["Implementation revenue", ({ r }) => formatNzd(r.implementationRevenue)],
    ["Recurring revenue (term)", ({ r }) => formatNzd(r.recurringRevenue)],
    ["Total revenue", ({ r }) => formatNzd(r.totalRevenue)],
    ["Delivery hours", ({ r }) => String(Math.round(r.totalHours))],
    ["Delivery cost", ({ r }) => formatNzd(r.deliveryCost)],
    ["Software cost", ({ r }) => formatNzd(r.softwareCost)],
    ["Other fixed costs", ({ r }) => formatNzd(r.fixedCost)],
    ["Gross profit", ({ r }) => formatNzd(r.grossProfit)],
    ["Gross margin", ({ r }) => (r.grossMargin == null ? "—" : pct(r.grossMargin))],
    ["Revenue per operator", ({ r }) => formatNzd(r.revenuePerOperator)],
    ["Break-even fee (programme only)", ({ r }) => formatNzd(r.breakEvenFee)],
  ];
  return (
    <div className="space-y-6">
      <Notice tone="info">Scenarios are assumptions for comparison — unvalidated commercial hypotheses, not forecasts. Attach rates are guesses until the pilot shows real conversion.</Notice>
      {results.length > 0 && (
        <Card title="Compare scenarios" padded={false}>
          <Table>
            <thead><tr><th /> {results.map(({ s }) => <th key={s.id} className="text-right">{s.name}</th>)}</tr></thead>
            <tbody>{rows.map(([label, fn]) => <tr key={label}><td className="text-muted">{label}</td>{results.map((x) => <td key={x.s.id} className={`text-right tabular-nums ${label.startsWith("Total") || label.startsWith("Gross") ? "font-semibold" : ""}`}>{fn(x)}</td>)}</tr>)}</tbody>
          </Table>
        </Card>
      )}
      {scenarios.map((s) => (
        <details key={s.id} className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Edit: {s.name}</summary>
          <div className="space-y-3 border-t border-line p-5">
            <ScenarioForm s={s} />
            <ActionForm action={deleteScenario.bind(null, s.id)} submitLabel="Delete scenario" variant="danger" confirm="Delete this scenario?" />
          </div>
        </details>
      ))}
      <Card title="New scenario"><ScenarioForm /></Card>
    </div>
  );
}

function ScenarioForm({ s }: { s?: PricingScenario }) {
  return (
    <ActionForm action={saveScenario.bind(null, s?.id ?? null)} submitLabel={s ? "Save scenario" : "Add scenario"} resetOnSuccess={!s}>
      <FormGrid cols={3}>
        <TextField name="name" label="Name" required defaultValue={s?.name} className="sm:col-span-3" />
        <TextField name="cohortSize" label="Cohort size" type="number" step="1" required defaultValue={s?.cohortSize ?? 10} />
        <TextField name="feePerOperatorNzd" label="Fee per operator" type="number" required defaultValue={s?.feePerOperatorNzd} />
        <TextField name="sponsorshipNzd" label="Sponsorship" type="number" defaultValue={s?.sponsorshipNzd ?? 0} />
        <TextField name="implementationAttachRate" label="Implementation take-up (%)" type="number" defaultValue={s ? Math.round(s.implementationAttachRate * 100) : 0} />
        <TextField name="implementationAvgNzd" label="Avg implementation value" type="number" defaultValue={s?.implementationAvgNzd ?? 0} />
        <TextField name="recurringAttachRate" label="Recurring take-up (%)" type="number" defaultValue={s ? Math.round(s.recurringAttachRate * 100) : 0} />
        <TextField name="recurringMonthlyNzd" label="Recurring per month" type="number" defaultValue={s?.recurringMonthlyNzd ?? 0} />
        <TextField name="recurringMonths" label="Recurring months counted" type="number" step="1" defaultValue={s?.recurringMonths ?? 12} />
        <TextField name="deliveryHoursPerOperator" label="Delivery hours / operator" type="number" defaultValue={s?.deliveryHoursPerOperator ?? 0} />
        <TextField name="sharedDeliveryHours" label="Shared hours (workshops, mgmt)" type="number" defaultValue={s?.sharedDeliveryHours ?? 0} />
        <TextField name="hourlyCostNzd" label="Hourly delivery cost" type="number" defaultValue={s?.hourlyCostNzd ?? 0} />
        <TextField name="softwareMonthlyNzd" label="Software per month" type="number" defaultValue={s?.softwareMonthlyNzd ?? 0} />
        <TextField name="programmeMonths" label="Programme months" type="number" step="1" defaultValue={s?.programmeMonths ?? 3} />
        <TextField name="otherFixedCostsNzd" label="Other fixed costs" type="number" defaultValue={s?.otherFixedCostsNzd ?? 0} />
        <TextField name="notes" label="Notes" defaultValue={s?.notes} className="sm:col-span-3" />
      </FormGrid>
    </ActionForm>
  );
}
