import { notFound } from "next/navigation";
import { PlanView } from "@/components/portal/views/PlanView";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { newLayoutEnabled } from "@/lib/brand";

export default async function PlanPage({ searchParams }: PageProps<"/portal/plan">) {
  const { user } = await requireOperatorFeature("portal.dashboard");
  // Phase 1 page: not part of the pilot experience while NEW_LAYOUT is off.
  if (!newLayoutEnabled()) notFound();
  const sp = await searchParams;
  return <PlanView actor={{ id: user.id, role: user.role, operatorId: user.operatorId }} basePath="/portal" show={sp.show} />;
}
