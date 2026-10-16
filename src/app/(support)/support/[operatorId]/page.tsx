import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { OverviewView } from "@/components/portal/views/OverviewView";
import { recordView } from "@/lib/support/core";
import { requireClientView } from "@/lib/support/session";
import { SupportBanner } from "./SupportBanner";

export const metadata: Metadata = { title: "Client view" };

export default async function SupportOverview({ params }: PageProps<"/support/[operatorId]">) {
  const { operatorId } = await params;
  const { admin, business, actor, features, grant } = await requireClientView(operatorId);
  await recordView(admin, business.id, "Overview");
  const banner = <SupportBanner business={business} editingUntil={grant?.expiresAt ?? null} />;
  if (!features.includes("portal.dashboard")) {
    return (
      <div>
        {banner}
        <PageHeader eyebrow="Your portal" title="Your portal" description="The business dashboard isn't enabled for your business. Contact the programme team if you need it." />
      </div>
    );
  }
  return (
    <div>
      {banner}
      <OverviewView actor={actor} basePath={`/support/${business.id}`} greetName={business.name} />
    </div>
  );
}
