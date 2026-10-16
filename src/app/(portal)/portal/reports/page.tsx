import { notFound } from "next/navigation";
import { ReportsView } from "@/components/portal/views/ReportsView";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { newLayoutEnabled } from "@/lib/brand";

export default async function ReportsPage() {
  const { user } = await requireOperatorFeature("portal.dashboard");
  // Phase 1 page: not part of the pilot experience while NEW_LAYOUT is off.
  if (!newLayoutEnabled()) notFound();
  return <ReportsView actor={{ id: user.id, role: user.role, operatorId: user.operatorId }} />;
}
