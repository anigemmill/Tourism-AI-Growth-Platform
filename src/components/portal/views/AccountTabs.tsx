import type { ReactNode } from "react";
import { Badge, Card, DefinitionList, EmptyState, Notice, Table } from "@/components/ui";
import { InvoiceBadge, SourceBadge, SubscriptionBadge, UserStatusBadge, fmtDate, fmtDateTime } from "@/components/admin/badges";
import { portalBilling, portalBusiness, portalTeam } from "@/lib/dal/portal";
import { formatMoney, invoiceBalance } from "@/lib/billing/calc";
import { INTERVAL_LABELS, ROLE_LABELS } from "@/lib/labels";

// Account & team tabs. Shared by /portal/account and the Super Admin client
// view; the caller resolves the actor and access. The optional editForm /
// memberActions slots are only filled by the client view in edit mode.

export const ACCOUNT_TABS = ["business", "team", "billing", "security"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];
export const ACCOUNT_TAB_LABELS: Record<AccountTab, string> = { business: "Business", team: "Team", billing: "Billing", security: "Sign-in & security" };

type Actor = Parameters<typeof portalBusiness>[0];

export async function BusinessTab({ actor, editForm }: { actor: Actor; editForm?: (biz: Awaited<ReturnType<typeof portalBusiness>>) => ReactNode }) {
  const biz = await portalBusiness(actor);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {editForm ? editForm(biz) : <Card title="Business profile" description="The details the programme team works from. Contact them to change anything here.">
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
      </Card>}
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

export async function TeamTab({ actor, memberActions }: { actor: Actor; memberActions?: (m: Awaited<ReturnType<typeof portalTeam>>[number]) => ReactNode }) {
  const team = await portalTeam(actor);
  return (
    <Card title="Team" description="People who can sign in to this business's portal. To add or remove someone, ask the programme team." padded={false}>
      {team.length === 0 ? <div className="p-5"><EmptyState title="No one else is linked yet" /></div> : (
        <Table>
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th>{memberActions && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}{m.id === actor.id && <span className="ml-1 text-xs text-muted">(you)</span>} {m.isPrimaryContact && <Badge tone="info">Primary contact</Badge>}</td>
                <td className="text-sm text-muted">{ROLE_LABELS[m.role]}</td>
                <td><UserStatusBadge s={m.status} /></td>
                <td className="text-xs text-muted">{fmtDateTime(m.lastLoginAt)}</td>
                {memberActions && <td>{memberActions(m)}</td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export async function BillingTab({ actor }: { actor: Actor }) {
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
