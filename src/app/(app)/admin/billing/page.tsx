import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { Badge, Card, Notice, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar, Pager } from "@/components/admin/ListControls";
import { fmtDate, InvoiceBadge, SourceBadge, SubscriptionBadge, TxnStatusBadge } from "@/components/admin/badges";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { oneOf, pageOf, param } from "@/lib/admin/paging";
import { billingOverview } from "@/lib/admin/overview";
import { formatMoney, invoiceBalance } from "@/lib/billing/calc";
import { BILLING_SOURCE_LABELS, INTERVAL_LABELS, TXN_KIND_LABELS, TXN_STATUS_LABELS, options } from "@/lib/labels";

const KINDS = ["PAYMENT", "REFUND", "CREDIT", "CHARGE"] as const;
const STATUSES = ["PENDING", "SUCCEEDED", "FAILED"] as const;
const SOURCES = ["MANUAL", "PROVIDER"] as const;

export default async function BillingPage({ searchParams }: PageProps<"/admin/billing">) {
  await requirePermission("billing.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const kind = oneOf(param(sp, "kind"), KINDS);
  const status = oneOf(param(sp, "status"), STATUSES);
  const source = oneOf(param(sp, "source"), SOURCES);
  const { page, skip, take } = pageOf(sp);
  const where: Prisma.BillingTransactionWhereInput = {
    ...(q ? { OR: [{ operator: { name: { contains: q, mode: "insensitive" } } }, { providerTransactionRef: { contains: q, mode: "insensitive" } }, { invoice: { number: { contains: q, mode: "insensitive" } } }] } : {}),
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
  };
  const [o, txns, total, openInvoices, subs] = await Promise.all([
    billingOverview(),
    prisma.billingTransaction.findMany({ where, skip, take, orderBy: { occurredAt: "desc" }, include: { operator: { select: { id: true, name: true } }, invoice: { select: { number: true } } } }),
    prisma.billingTransaction.count({ where }),
    prisma.invoice.findMany({ where: { status: "OPEN" }, orderBy: { dueAt: "asc" }, include: { operator: { select: { id: true, name: true } }, transactions: true }, take: 50 }),
    prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }, orderBy: { renewalDate: "asc" }, include: { operator: { select: { id: true, name: true } } }, take: 50 }),
  ]);
  const now = new Date();

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Billing" description="Subscriptions, invoices, payments, refunds and adjustments across all businesses. Record new items from a business's page." />
      <div className="mb-6"><Notice tone="info">No payment provider is connected yet, so every record is <strong>manually recorded</strong> by an administrator and is not provider-confirmed. See docs/BILLING.md for the proposed provider integration.</Notice></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active subscriptions" value={o.activeSubscriptions} sub={`${formatMoney(o.monthlyRecurringCents)} / month (NZD)`} />
        <Stat label="Outstanding" value={formatMoney(o.outstandingCents)} sub={`${o.openInvoices} open · ${o.overdueInvoices} overdue`} tone={o.overdueInvoices ? "warning" : "default"} />
        <Stat label="Failed payments (90 days)" value={o.failedPayments90d} tone={o.failedPayments90d ? "danger" : "default"} />
        <Stat label="Received (90 days)" value={formatMoney(o.providerConfirmed90dCents + o.manual90dCents)} sub={`${formatMoney(o.providerConfirmed90dCents)} provider-confirmed · ${formatMoney(o.manual90dCents)} manually recorded`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Open invoices" padded={false}>
          <Table>
            <thead><tr><th>Business</th><th>Invoice</th><th>Balance</th><th>Due</th></tr></thead>
            <tbody>
              {openInvoices.length === 0 && <tr><td colSpan={4} className="text-sm text-muted">No open invoices.</td></tr>}
              {openInvoices.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/admin/businesses/${i.operator.id}`} className="hover:underline">{i.operator.name}</Link></td>
                  <td className="text-sm">{i.number} <InvoiceBadge s={i.status} /></td>
                  <td className="text-sm">{formatMoney(invoiceBalance(i, i.transactions), i.currency)}</td>
                  <td className="text-xs">{fmtDate(i.dueAt)} {i.dueAt && i.dueAt < now && <Badge tone="danger">Overdue</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Renewals" padded={false}>
          <Table>
            <thead><tr><th>Business</th><th>Plan</th><th>Status</th><th>Renews</th></tr></thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={4} className="text-sm text-muted">No active subscriptions.</td></tr>}
              {subs.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/businesses/${s.operator.id}`} className="hover:underline">{s.operator.name}</Link></td>
                  <td className="text-sm">{s.plan}<p className="text-xs text-muted">{formatMoney(s.amountCents, s.currency)} {INTERVAL_LABELS[s.interval].toLowerCase()}</p></td>
                  <td><SubscriptionBadge s={s.status} /></td>
                  <td className="text-xs text-muted">{fmtDate(s.renewalDate)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
      <FilterBar
        action="/admin/billing"
        q={q}
        placeholder="Business, invoice or reference"
        filters={[
          { name: "kind", label: "Type", value: kind ?? "", options: options(TXN_KIND_LABELS) },
          { name: "status", label: "Status", value: status ?? "", options: options(TXN_STATUS_LABELS) },
          { name: "source", label: "Source", value: source ?? "", options: options(BILLING_SOURCE_LABELS) },
        ]}
      />
      <Card padded={false}>
        <Table>
          <thead><tr><th>Date</th><th>Business</th><th>Type</th><th>Amount</th><th>Status</th><th>Source</th></tr></thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap text-xs text-muted">{fmtDate(t.occurredAt)}</td>
                <td><Link href={`/admin/businesses/${t.operator.id}`} className="hover:underline">{t.operator.name}</Link>{t.invoice && <p className="text-xs text-muted">{t.invoice.number}</p>}</td>
                <td className="text-sm">{TXN_KIND_LABELS[t.kind]}</td>
                <td className="text-sm">{formatMoney(t.amountCents, t.currency)}</td>
                <td><TxnStatusBadge s={t.status} /></td>
                <td><SourceBadge s={t.source} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager base="/admin/billing" sp={sp} page={page} total={total} />
      </Card>
    </div>
  );
}
