import { AccountPanel } from "@/components/AccountPanel";
import { PageHeader, Tabs } from "@/components/ui";
import { ACCOUNT_TABS as TABS, ACCOUNT_TAB_LABELS as TAB_LABELS, BillingTab, BusinessTab, TeamTab, type AccountTab as Tab } from "@/components/portal/views/AccountTabs";
import { requireOperator } from "@/lib/auth/portal";
import { newLayoutEnabled } from "@/lib/brand";

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

