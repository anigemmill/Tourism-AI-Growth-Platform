import type { Metadata } from "next";
import { ActionForm, Card, ConfirmBox, FormGrid, PageHeader, Select, Tabs, TextField } from "@/components/ui";
import { ACCOUNT_TAB_LABELS, BillingTab, BusinessTab, TeamTab } from "@/components/portal/views/AccountTabs";
import { OPERATOR_CATEGORIES } from "@/lib/labels";
import { recordView } from "@/lib/support/core";
import { requireClientView } from "@/lib/support/session";
import { SupportBanner } from "../SupportBanner";
import { teamActionAction, updateBusinessDetailsAction } from "../actions";

export const metadata: Metadata = { title: "Client view · Account & team" };

// No "Sign-in & security" tab: that tab shows the signed-in person's own
// account, which here would be the Super Admin's, not the client's.
const TABS = ["business", "team", "billing"] as const;
type Tab = (typeof TABS)[number];

export default async function SupportAccount({ params, searchParams }: PageProps<"/support/[operatorId]/account">) {
  const { operatorId } = await params;
  const { admin, business, actor, grant } = await requireClientView(operatorId);
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "business";
  await recordView(admin, business.id, `Account & team (${ACCOUNT_TAB_LABELS[tab]})`);
  const base = `/support/${business.id}/account`;
  const editing = Boolean(grant);

  return (
    <div>
      <SupportBanner business={business} editingUntil={grant?.expiresAt ?? null} />
      <PageHeader eyebrow="Account" title="Account & team" description="Your business details, the people who can see them, billing and your sign-in." />
      <Tabs current={tab === "business" ? base : `${base}?tab=${tab}`} tabs={TABS.map((t) => ({ href: t === "business" ? base : `${base}?tab=${t}`, label: ACCOUNT_TAB_LABELS[t] }))} />
      {tab === "business" && (
        <BusinessTab
          actor={actor}
          editForm={
            editing
              ? (biz) => (
                  <Card title="Business profile" description="Editing on behalf of the client. Saved changes are logged under your name.">
                    <ActionForm action={updateBusinessDetailsAction.bind(null, business.id)} submitLabel="Save business details">
                      <FormGrid>
                        <TextField name="name" label="Business name" defaultValue={biz.name} required />
                        <Select name="category" label="Category" defaultValue={biz.category} options={OPERATOR_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                        <TextField name="websiteUrl" label="Website" type="url" defaultValue={biz.websiteUrl ?? ""} />
                        <TextField name="bookingUrl" label="Booking page" type="url" defaultValue={biz.bookingUrl ?? ""} />
                        <TextField name="contactName" label="Primary contact" defaultValue={biz.contactName ?? ""} />
                        <TextField name="contactEmail" label="Contact email" type="email" defaultValue={biz.contactEmail ?? ""} />
                        <TextField name="contactPhone" label="Contact phone" defaultValue={biz.contactPhone ?? ""} />
                      </FormGrid>
                    </ActionForm>
                  </Card>
                )
              : undefined
          }
        />
      )}
      {tab === "team" && (
        <TeamTab
          actor={actor}
          memberActions={
            editing
              ? (m) => {
                  const act = (action: string) => teamActionAction.bind(null, business.id, m.id, action);
                  if (m.role !== "OPERATOR") return null;
                  if (m.status === "PENDING") return <ActionForm action={act("resend_invite")} inline submitLabel="Resend invitation" variant="secondary" />;
                  if (m.status === "ACTIVE")
                    return (
                      <div className="flex flex-col gap-1.5">
                        <ActionForm action={act("password_reset")} inline submitLabel="Send reset link" variant="secondary" />
                        <ActionForm action={act("suspend")} inline submitLabel="Suspend" variant="danger">
                          <ConfirmBox>Sign {m.name} out and block access</ConfirmBox>
                        </ActionForm>
                      </div>
                    );
                  if (m.status === "SUSPENDED")
                    return (
                      <ActionForm action={act("reactivate")} inline submitLabel="Reactivate" variant="secondary">
                        <ConfirmBox>Restore {m.name}&apos;s access</ConfirmBox>
                      </ActionForm>
                    );
                  return null;
                }
              : undefined
          }
        />
      )}
      {tab === "billing" && <BillingTab actor={actor} />}
    </div>
  );
}
