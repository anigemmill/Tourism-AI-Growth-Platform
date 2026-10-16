import { AccountPanel } from "@/components/AccountPanel";
import { Badge, Card, DefinitionList, EmptyState, Notice, PageHeader, Table, Tabs } from "@/components/ui";
import { InvoiceBadge, SourceBadge, SubscriptionBadge, UserStatusBadge, fmtDate, fmtDateTime } from "@/components/admin/badges";
import { requireOperator } from "@/lib/auth/portal";
import { portalBilling, portalBusiness, portalTeam } from "@/lib/dal/portal";
import { formatMoney, invoiceBalance } from "@/lib/billing/calc";
import { INTERVAL_LABELS, ROLE_LABELS } from "@/lib/labels";
import { newLayoutEnabled } from "@/lib/brand";

const TABS = ["business", "team", "billing", "security"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { business: "Business", team: "Team", billing: "Billing", security: "Sign-in & security" };

export default async function PortalAccountPage({ searchParams }: PageProps<"/portal/account">) {
  const { user } = await requireOperator();
  if (!newLayoutEnabled()) {
    // Rotorua pilot: the pre-Phase-1 "My account" page, unchanged.
    return (
      <div>
        <PageHeader eyebrow="Account" title="My account" description="Your profile, password and signed-in devices." />
        <AccountPanel user={user} />
      </div>
    );
  }
  const actor = { id: user.id, role: user.role, operatorId: user.operatorId };
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "business";

  return (
    <div>
      <PageHeader eyebrow="Account" title="Account & team" description="Your business details, the people who can see them, billing and your sign-in." />
      <Tabs current={tab === "business" ? "/portal/account" : `/portal/account?tab=${tab}`} tabs={TABS.map((t) => ({ href: t === "business" ? "/portal/account" : `/portal/account?tab=${t}`, label: TAB_LABELS[t] }))} />
      {tab === "business" && <BusinessTab actor={actor} />}
      {tab === "team" && <TeamTab actor={actor} />}
      {tab === "billing" && <BillingTab actor={actor} />}
      {tab === "security" && <AccountPanel user={user} />}
    </div>
  );
}

type Actor = Parameters<typeof portalBusiness>[0];

async function BusinessTab({ actor }: { actor: Actor }) {
  const biz = await portalBusiness(actor);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Business profile" description="The details the programme team works from. Contact them to change anything here.">
        <DefinitionList
          items={[
            { label: "Business name", value: biz.name },
            { label: "Category", value: biz.category },
            { label: "Website", value: biz.websiteUrl },
            { label: "Booking page", value: biz.bookingUrl },
            { label: "Programme", value: biz.programme?.name },
            { label: "Cohort", value: biz.cohort },
            { label: "Primary contact", value: biz.contactName },
            { label: "Contact email", value: biz.contactEmail },
          ]}
        />
      </Card>
      <Card title="What you've agreed to share">
        <DefinitionList
          items={[
            { label: "Scope", value: biz.agreedScope },
            { label: "Data agreement", value: biz.dataAgreementSignedAt ? `Signed ${fmtDate(biz.dataAgreementSignedAt)}` : "Not yet signed" },
            {
              label: "Sharing",
              value: (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={biz.consentCohortSharing ? "success" : "outline"}>Cohort learnings</Badge>
                  <Badge tone={biz.consentAggregate ? "success" : "outline"}>Anonymised totals</Badge>
                  <Badge tone={biz.consentCaseStudy ? "success" : "outline"}>Public case study</Badge>
                </span>
              ),
            },
            { label: "Retention", value: biz.dataRetentionNotes },
          ]}
        />
      </Card>
    </div>
  );
}

async function TeamTab({ actor }: { actor: Actor }) {
  const team = await portalTeam(actor);
  return (
    <Card title="Team" description="People who can sign in to this business's portal. To add or remove someone, ask the programme team." padded={false}>
      {team.length === 0 ? <div className="p-5"><EmptyState title="No one else is linked yet" /></div> : (
        <Table>
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}{m.id === actor.id && <span className="ml-1 text-xs text-muted">(you)</span>} {m.isPrimaryContact && <Badge tone="info">Primary contact</Badge>}</td>
                <td className="text-sm text-muted">{ROLE_LABELS[m.role]}</td>
                <td><UserStatusBadge s={m.status} /></td>
                <td className="text-xs text-muted">{fmtDateTime(m.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function BillingTab({ actor }: { actor: Actor }) {
  const { subscriptions, invoices } = await portalBilling(actor);
  return (
    <div className="space-y-6">
      <Notice tone="info">Billing is handled by the programme team. Amounts shown were recorded by the team and are labelled with their source.</Notice>
      <Card title="Plan" padded={false}>
        {subscriptions.length === 0 ? <div className="p-5"><EmptyState title="No plan on record" /></div> : (
          <Table>
            <thead><tr><th>Plan</th><th>Status</th><th>Amount</th><th>Renews</th><th>Source</th></tr></thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.plan}</td>
                  <td><SubscriptionBadge s={s.status} /></td>
                  <td className="text-sm">{formatMoney(s.amountCents, s.currency)} <span className="text-xs text-muted">{INTERVAL_LABELS[s.interval].toLowerCase()}</span></td>
                  <td className="text-xs text-muted">{fmtDate(s.renewalDate)}</td>
                  <td><SourceBadge s={s.source} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="Invoices" padded={false}>
        {invoices.length === 0 ? <div className="p-5"><EmptyState title="No invoices yet" /></div> : (
          <Table>
            <thead><tr><th>Invoice</th><th>Issued</th><th>Amount</th><th>Balance</th><th>Status</th><th>Source</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.number}</td>
                  <td className="text-xs text-muted">{fmtDate(i.issuedAt)}{i.dueAt && <span className="block">Due {fmtDate(i.dueAt)}</span>}</td>
                  <td className="text-sm">{formatMoney(i.amountCents, i.currency)}</td>
                  <td className="text-sm">{formatMoney(invoiceBalance(i, i.transactions), i.currency)}</td>
                  <td><InvoiceBadge s={i.status} /></td>
                  <td><SourceBadge s={i.source} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
