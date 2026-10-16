import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportsView } from "@/components/portal/views/ReportsView";
import { recordView } from "@/lib/support/core";
import { requireClientView } from "@/lib/support/session";
import { SupportBanner } from "../SupportBanner";

export const metadata: Metadata = { title: "Client view · Reports" };

export default async function SupportReports({ params }: PageProps<"/support/[operatorId]/reports">) {
  const { operatorId } = await params;
  const { admin, business, actor, features, grant } = await requireClientView(operatorId);
  if (!features.includes("portal.dashboard")) redirect(`/support/${business.id}`);
  await recordView(admin, business.id, "Reports");
  return (
    <div>
      <SupportBanner business={business} editingUntil={grant?.expiresAt ?? null} />
      <ReportsView actor={actor} />
    </div>
  );
}
