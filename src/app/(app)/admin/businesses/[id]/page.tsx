import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionForm, Badge, ButtonLink, Card, ConfirmBox, DefinitionList, FormGrid, Notice, OperatorStatusBadge, PageHeader, Progress, Select, Table, TextArea, TextField,
} from "@/components/ui";
import { AccountStatusBadge, fmtDate, fmtDateTime, InvoiceBadge, RoleBadge, SourceBadge, SubscriptionBadge, TxnStatusBadge, UserStatusBadge } from "@/components/admin/badges";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { onboardingSteps } from "@/lib/admin/businesses";
import { CURRENCIES, formatMoney, invoiceBalance, paymentTotals } from "@/lib/billing/calc";
import { enabledFeatures, FEATURES, ALL_FEATURES } from "@/lib/rbac/features";
import { getBrand } from "@/lib/brand";
import {
  ACCOUNT_STATUS_LABELS, INTERVAL_LABELS, INVOICE_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS, TXN_KIND_LABELS, TXN_STATUS_LABELS, options,
} from "@/lib/labels";
import * as act from "../actions";

export default async function AdminBusinessPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const me = await requirePermission("businesses.view");
  const { id } = await params;
  const showBilling = can(me, "billing.view");
  const b = await prisma.operator.findUnique({
    where: { id },
    include: {
      programme: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } },
      features: true,
      profile: { select: { id: true } },
      _count: { select: { assessments: true } },
    },
  });
  if (!b) notFound();
  const [programmes, history, subscriptions, invoices, txns, events] = await Promise.all([
    prisma.programme.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ where: { entityType: "operator", entityId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
    showBilling ? prisma.subscription.findMany({ where: { operatorId: id }, orderBy: { createdAt: "desc" } }) : [],
    showBilling ? prisma.invoice.findMany({ where: { operatorId: id }, orderBy: { issuedAt: "desc" }, include: { transactions: true } }) : [],
    showBilling ? prisma.billingTransaction.findMany({ where: { operatorId: id }, orderBy: { occurredAt: "desc" }, include: { invoice: { select: { number: true } }, recordedBy: { select: { name: true } } } }) : [],
    showBilling ? prisma.billingEvent.findMany({ where: { operatorId: id }, orderBy: { createdAt: "desc" }, take: 30 }) : [],
  ]);

  const canManage = can(me, "businesses.manage");
  const canBill = can(me, "billing.manage");
  const enabled = new Set(enabledFeatures(b.features, getBrand().id));
  const onboarding = onboardingSteps({
    dataAgreementSignedAt: b.dataAgreementSignedAt, contactEmail: b.contactEmail, programmeId: b.programmeId,
    members: b.members.length, activeMembers: b.members.filter((m) => m.user.status === "ACTIVE").length,
    assessments: b._count.assessments, hasProfile: Boolean(b.profile),
  }, getBrand().id);
  const totals = paymentTotals(txns);
  const outstanding = invoices.filter((i) => i.status === "OPEN").reduce((s, i) => s + Math.max(0, invoiceBalance(i, i.transactions)), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/admin/businesses" className="hover:underline">Businesses</Link>}
        title={b.name}
        description={`${b.category}${b.programme ? ` · ${b.programme.name}` : ""}${b.cohort ? ` · ${b.cohort}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Account</span> <AccountStatusBadge s={b.accountStatus} />
            <span className="ml-2 text-xs text-muted">Programme</span> <OperatorStatusBadge s={b.status} />
            {can(me, "operators.view") && <ButtonLink href={`/operators/${b.id}`} variant="secondary">Programme record</ButtonLink>}
            {can(me, "operators.edit") && <ButtonLink href={`/operators/${b.id}/edit`} variant="secondary">Edit profile</ButtonLink>}
          </div>
        }
      />
      {b.accountStatus !== "ACTIVE" && <div className="mb-6"><Notice tone="warning">This business account is {ACCOUNT_STATUS_LABELS[b.accountStatus].toLowerCase()}: its tourism operator users can&apos;t use the portal for it.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Profile & primary contact">
            <DefinitionList
              items={[
                { label: "Primary contact", value: b.contactName ?? "—" },
                { label: "Email", value: b.contactEmail ?? "—" },
                { label: "Phone", value: b.contactPhone ?? "—" },
                { label: "Website", value: b.websiteUrl ?? "—" },
                { label: "Data agreement", value: b.dataAgreementSignedAt ? `Signed ${fmtDate(b.dataAgreementSignedAt)}` : "Not signed" },
                { label: "Added", value: fmtDate(b.createdAt) },
              ]}
            />
          </Card>

          <Card title="Linked users" description="Manage links from each user's page, or invite someone new from Users." padded={false} actions={can(me, "users.manage") ? <ButtonLink href="/admin/users" variant="secondary">Invite user</ButtonLink> : undefined}>
            <Table>
              <tbody>
                {b.members.length === 0 && <tr><td className="text-sm text-muted">No users linked yet.</td></tr>}
                {b.members.map((m) => (
                  <tr key={m.userId}>
                    <td>{can(me, "users.view") ? <Link href={`/admin/users/${m.userId}`} className="font-medium hover:underline">{m.user.name}</Link> : <span className="font-medium">{m.user.name}</span>}<p className="text-xs text-muted">{m.user.email}</p></td>
                    <td><RoleBadge r={m.user.role} /> {m.isPrimaryContact && <Badge tone="info">Primary contact</Badge>}</td>
                    <td><UserStatusBadge s={m.user.status} /></td>
                    <td className="text-xs text-muted">Last sign-in {fmtDateTime(m.user.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {showBilling && (
            <>
              <Card title="Billing summary">
                <Notice tone="info">No payment provider is connected. Every amount below was entered by an administrator and is labelled “Manually recorded” — it has not been confirmed by a payment provider.</Notice>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted">Outstanding</dt><dd className="font-mono text-lg">{formatMoney(outstanding)}</dd></div>
                  <div><dt className="text-xs text-muted">Provider-confirmed received</dt><dd className="font-mono text-lg">{formatMoney(totals.providerConfirmedCents)}</dd></div>
                  <div><dt className="text-xs text-muted">Manually recorded received</dt><dd className="font-mono text-lg">{formatMoney(totals.manuallyRecordedCents)}</dd></div>
                  <div><dt className="text-xs text-muted">Failed payments</dt><dd className="font-mono text-lg">{totals.failedCount}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-subtle">Totals assume NZD; records in other currencies are listed individually below.</p>
              </Card>

              <Card title="Subscriptions" padded={false}>
                <Table>
                  <thead><tr><th>Plan</th><th>Status</th><th>Amount</th><th>Renewal</th><th>Source</th>{canBill && <th />}</tr></thead>
                  <tbody>
                    {subscriptions.length === 0 && <tr><td colSpan={6} className="text-sm text-muted">No subscription recorded.</td></tr>}
                    {subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.plan}<p className="text-xs text-muted">{s.providerCustomerRef ? `Customer ref ${s.providerCustomerRef}` : ""}</p></td>
                        <td><SubscriptionBadge s={s.status} /></td>
                        <td className="text-sm">{formatMoney(s.amountCents, s.currency)} <span className="text-xs text-muted">{INTERVAL_LABELS[s.interval].toLowerCase()}</span></td>
                        <td className="text-xs text-muted">{fmtDate(s.renewalDate)}</td>
                        <td><SourceBadge s={s.source} /></td>
                        {canBill && (
                          <td>
                            <details><summary className="cursor-pointer text-xs text-accent">Update</summary>
                              <div className="mt-2 w-64">
                                <ActionForm action={act.updateSubscription.bind(null, b.id, s.id)} submitLabel="Save">
                                  <Select name="status" label="Status" defaultValue={s.status} options={options(SUBSCRIPTION_STATUS_LABELS)} />
                                  <TextField name="renewalDate" label="Renewal date" type="date" defaultValue={s.renewalDate?.toISOString().slice(0, 10)} />
                                  <ConfirmBox required={false}>Required when cancelling</ConfirmBox>
                                </ActionForm>
                              </div>
                            </details>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              <Card title="Invoices" padded={false}>
                <Table>
                  <thead><tr><th>Invoice</th><th>Status</th><th>Amount</th><th>Balance</th><th>Due</th><th>Source</th>{canBill && <th />}</tr></thead>
                  <tbody>
                    {invoices.length === 0 && <tr><td colSpan={7} className="text-sm text-muted">No invoices recorded.</td></tr>}
                    {invoices.map((i) => {
                      const bal = invoiceBalance(i, i.transactions);
                      const overdue = i.status === "OPEN" && i.dueAt && i.dueAt < new Date() && bal > 0;
                      return (
                        <tr key={i.id}>
                          <td className="font-medium">{i.number}<p className="text-xs text-muted">Issued {fmtDate(i.issuedAt)}</p></td>
                          <td><InvoiceBadge s={i.status} /> {overdue && <Badge tone="danger">Overdue</Badge>}</td>
                          <td className="text-sm">{formatMoney(i.amountCents, i.currency)}</td>
                          <td className="text-sm">{formatMoney(bal, i.currency)}</td>
                          <td className="text-xs text-muted">{fmtDate(i.dueAt)}</td>
                          <td><SourceBadge s={i.source} /></td>
                          {canBill && i.source === "MANUAL" && (
                            <td>
                              <details><summary className="cursor-pointer text-xs text-accent">Status</summary>
                                <div className="mt-2 w-56">
                                  <ActionForm action={act.setInvoiceStatus.bind(null, b.id, i.id)} submitLabel="Save">
                                    <Select name="status" label="Status" defaultValue={i.status} options={options(INVOICE_STATUS_LABELS)} />
                                    <ConfirmBox>Change this invoice&apos;s status</ConfirmBox>
                                  </ActionForm>
                                </div>
                              </details>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card>

              <Card title="Payments, refunds & adjustments" padded={false}>
                <Table>
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Source</th><th>Details</th></tr></thead>
                  <tbody>
                    {txns.length === 0 && <tr><td colSpan={6} className="text-sm text-muted">Nothing recorded.</td></tr>}
                    {txns.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap text-xs text-muted">{fmtDate(t.occurredAt)}</td>
                        <td className="text-sm">{TXN_KIND_LABELS[t.kind]}{t.invoice && <p className="text-xs text-muted">{t.invoice.number}</p>}</td>
                        <td className="text-sm">{formatMoney(t.amountCents, t.currency)}</td>
                        <td><TxnStatusBadge s={t.status} />{t.failureReason && <p className="text-xs text-danger">{t.failureReason}</p>}</td>
                        <td><SourceBadge s={t.source} /></td>
                        <td className="text-xs text-muted">{[t.method, t.providerTransactionRef && `Ref ${t.providerTransactionRef}`, t.note, t.recordedBy && `by ${t.recordedBy.name}`].filter(Boolean).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              {canBill && (
                <Card title="Record billing" description="Records here are always marked “Manually recorded”. Never enter card numbers or payment credentials.">
                  <div className="space-y-8">
                    <section>
                      <h3 className="mb-3 text-sm font-semibold">Payment, refund or adjustment</h3>
                      <ActionForm action={act.recordTransaction.bind(null, b.id)} submitLabel="Record" resetOnSuccess>
                        <FormGrid cols={3}>
                          <Select name="kind" label="Type" options={options(TXN_KIND_LABELS)} defaultValue="PAYMENT" />
                          <Select name="status" label="Status" options={options(TXN_STATUS_LABELS)} defaultValue="SUCCEEDED" />
                          <TextField name="occurredAt" label="Date" type="date" defaultValue={today} required />
                          <TextField name="amount" label="Amount" required placeholder="0.00" />
                          <Select name="currency" label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="NZD" />
                          <Select name="invoiceId" label="Invoice" placeholder="—" options={invoices.map((i) => ({ value: i.id, label: `${i.number} (${INVOICE_STATUS_LABELS[i.status]})` }))} />
                          <TextField name="method" label="Method" placeholder="e.g. bank transfer" />
                          <TextField name="reference" label="Reference" placeholder="e.g. bank or provider reference" />
                          <TextField name="failureReason" label="Failure reason (if failed)" />
                        </FormGrid>
                        <TextArea name="note" label="Note (required for refunds and adjustments)" rows={2} />
                        <ConfirmBox>I&apos;m recording this from a real source document. It will be shown as manually recorded, not provider-confirmed.</ConfirmBox>
                      </ActionForm>
                    </section>
                    <section>
                      <h3 className="mb-3 text-sm font-semibold">Invoice</h3>
                      <ActionForm action={act.createInvoice.bind(null, b.id)} submitLabel="Record invoice" resetOnSuccess>
                        <FormGrid cols={3}>
                          <TextField name="number" label="Invoice number" required />
                          <TextField name="amount" label="Amount" required placeholder="0.00" />
                          <Select name="currency" label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="NZD" />
                          <TextField name="issuedAt" label="Issued" type="date" defaultValue={today} required />
                          <TextField name="dueAt" label="Due" type="date" />
                          <Select name="status" label="Status" options={options(INVOICE_STATUS_LABELS)} defaultValue="OPEN" />
                          <Select name="subscriptionId" label="Subscription" placeholder="—" options={subscriptions.map((s) => ({ value: s.id, label: s.plan }))} />
                          <TextField name="providerRef" label="External reference" />
                        </FormGrid>
                        <TextArea name="notes" label="Notes" rows={2} />
                      </ActionForm>
                    </section>
                    <section>
                      <h3 className="mb-3 text-sm font-semibold">Subscription</h3>
                      <ActionForm action={act.createSubscription.bind(null, b.id)} submitLabel="Record subscription" resetOnSuccess>
                        <FormGrid cols={3}>
                          <TextField name="plan" label="Plan" required placeholder="e.g. Growth Pilot" />
                          <TextField name="amount" label="Amount per period" required placeholder="0.00" />
                          <Select name="currency" label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="NZD" />
                          <Select name="interval" label="Billing period" options={options(INTERVAL_LABELS)} defaultValue="MONTHLY" />
                          <Select name="status" label="Status" options={options(SUBSCRIPTION_STATUS_LABELS)} defaultValue="ACTIVE" />
                          <TextField name="currentPeriodStart" label="Current period start" type="date" />
                          <TextField name="renewalDate" label="Renewal date" type="date" />
                          <TextField name="providerCustomerRef" label="Customer reference" />
                        </FormGrid>
                        <TextArea name="notes" label="Notes" rows={2} />
                      </ActionForm>
                    </section>
                  </div>
                </Card>
              )}

              <Card title="Billing history & notes" padded={false}>
                {canBill && (
                  <div className="border-b border-line p-4">
                    <ActionForm action={act.addBillingNote.bind(null, b.id)} submitLabel="Add note" resetOnSuccess>
                      <TextArea name="note" label="Admin note" rows={2} />
                    </ActionForm>
                  </div>
                )}
                <Table>
                  <tbody>
                    {events.length === 0 && <tr><td className="text-sm text-muted">No billing history.</td></tr>}
                    {events.map((e) => (
                      <tr key={e.id}><td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(e.createdAt)}</td><td className="text-xs text-muted">{e.type}</td><td className="text-sm">{e.summary}</td></tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}

          <Card title="Account history" padded={false}>
            <Table>
              <tbody>
                {history.length === 0 && <tr><td className="text-sm text-muted">No recorded changes.</td></tr>}
                {history.map((h) => (
                  <tr key={h.id}><td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(h.createdAt)}</td><td className="text-xs text-muted">{h.action}</td><td className="text-sm">{h.summary}<p className="text-[11px] text-subtle">by {h.actor?.name ?? "system"}</p></td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Onboarding" description={`${onboarding.done} of ${onboarding.total} steps`}>
            <Progress value={onboarding.done} max={onboarding.total} />
            <ul className="mt-4 space-y-1.5 text-sm">
              {onboarding.steps.map((s) => <li key={s.label} className={s.done ? "text-ink" : "text-muted"}>{s.done ? "✓" : "○"} {s.label}</li>)}
            </ul>
          </Card>

          <Card title="Enabled features" description="Portal modules for this business's users.">
            <ul className="space-y-3">
              {ALL_FEATURES.map((f) => (
                <li key={f} className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-medium">{FEATURES[f].label}</p><p className="text-xs text-muted">{FEATURES[f].description}</p></div>
                  {canManage ? (
                    <ActionForm action={act.setFeature.bind(null, b.id, f)} inline submitLabel={enabled.has(f) ? "Disable" : "Enable"} variant={enabled.has(f) ? "ghost" : "secondary"}>
                      <input type="hidden" name="enabled" value={enabled.has(f) ? "false" : "true"} />
                    </ActionForm>
                  ) : (
                    <Badge tone={enabled.has(f) ? "success" : "outline"}>{enabled.has(f) ? "On" : "Off"}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {canManage && (
            <Card title="Programme & cohort">
              <ActionForm action={act.setProgramme.bind(null, b.id)} submitLabel="Save">
                <Select name="programmeId" label="Programme" placeholder="—" defaultValue={b.programmeId} options={programmes.map((p) => ({ value: p.id, label: p.name }))} />
                <TextField name="cohort" label="Cohort" defaultValue={b.cohort} placeholder="e.g. Rotorua 2026 cohort 1" />
              </ActionForm>
            </Card>
          )}

          {canManage && (
            <Card title="Account status" description="Suspended or archived businesses are blocked from the operator portal immediately. Their data is kept.">
              <ActionForm action={act.setAccountStatus.bind(null, b.id)} submitLabel="Change status" variant="danger">
                <Select name="status" label="Status" defaultValue={b.accountStatus} options={options(ACCOUNT_STATUS_LABELS)} />
                <ConfirmBox>I understand this can block {b.name}&apos;s users from the portal.</ConfirmBox>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
