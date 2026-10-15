import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Card, DealStageBadge, FormGrid, IllustrativeBadge, PageHeader, Stat, Table, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { dealValue } from "@/lib/domain/commercial";
import { formatDate, formatNzd } from "@/lib/format";
import { addPayment, updateDeal } from "../../actions";
import { DealFields } from "../../DealFields";

export default async function DealPage({ params }: PageProps<"/commercial/deals/[id]">) {
  await requirePermission("commercial.view");
  const { id } = await params;
  const d = await prisma.deal.findUnique({ where: { id }, include: { payments: { orderBy: { receivedAt: "desc" } }, costs: true } });
  if (!d) notFound();
  const received = d.payments.reduce((s, p) => s + p.amountNzd, 0);
  const costs = d.costs.reduce((s, c) => s + c.amountNzd, 0);
  return (
    <div>
      <PageHeader eyebrow={<Link href="/commercial" className="hover:underline">Commercial</Link>} title={d.title} description={<span className="flex gap-1.5"><DealStageBadge s={d.stage} />{d.isIllustrative && <IllustrativeBadge />}</span>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Contract value" value={formatNzd(dealValue(d))} sub={d.stage === "CONTRACTED" ? "contracted" : `${d.stage.toLowerCase()} — not revenue`} />
        <Stat label="Received" value={formatNzd(received)} tone="success" />
        <Stat label="Linked costs" value={formatNzd(costs)} />
        <Stat label="Margin on received" value={received ? `${Math.round(((received - costs) / received) * 100)}%` : "—"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Deal" className="lg:col-span-2"><ActionForm action={updateDeal.bind(null, d.id)} submitLabel="Save deal"><DealFields d={d} operatorOpts={await operatorOptions()} /></ActionForm></Card>
        <Card title="Payments received" padded={false}>
          {d.payments.length > 0 && <Table><tbody>{d.payments.map((p) => <tr key={p.id}><td className="tabular-nums">{formatNzd(p.amountNzd)}</td><td className="text-xs text-muted">{formatDate(p.receivedAt)}</td><td className="text-xs text-muted">{p.reference}</td></tr>)}</tbody></Table>}
          <div className="p-5">
            {d.stage !== "CONTRACTED" ? <p className="text-sm text-muted">Payments can be recorded once the deal is contracted.</p> : (
              <ActionForm action={addPayment.bind(null, d.id)} submitLabel="Record payment" resetOnSuccess>
                <FormGrid cols={1}>
                  <TextField name="amountNzd" label="Amount (NZD excl. GST)" type="number" required />
                  <TextField name="receivedAt" label="Received" type="date" required />
                  <TextField name="reference" label="Invoice / reference" />
                </FormGrid>
              </ActionForm>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
