import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanView } from "@/components/portal/views/PlanView";
import { recordView } from "@/lib/support/core";
import { requireClientView } from "@/lib/support/session";
import { SupportBanner } from "../SupportBanner";

export const metadata: Metadata = { title: "Client view · Action plan" };

export default async function SupportPlan({ params, searchParams }: PageProps<"/support/[operatorId]/plan">) {
  const { operatorId } = await params;
  const { admin, business, actor, features, grant } = await requireClientView(operatorId);
  // Same rule as the client's portal: no dashboard feature, no plan page.
  if (!features.includes("portal.dashboard")) redirect(`/support/${business.id}`);
  await recordView(admin, business.id, "Action plan");
  const sp = await searchParams;
  return (
    <div>
      <SupportBanner business={business} editingUntil={grant?.expiresAt ?? null} />
      <PlanView actor={actor} basePath={`/support/${business.id}`} show={sp.show} />
    </div>
  );
}
