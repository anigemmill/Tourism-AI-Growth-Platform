import { PageHeader } from "@/components/ui";
import { OverviewView } from "@/components/portal/views/OverviewView";
import { requireOperator } from "@/lib/auth/portal";
import { can } from "@/lib/auth/session";
import { submitSignal } from "./actions";
import { newLayoutEnabled } from "@/lib/brand";
import { LegacyPortalHome } from "./LegacyHome";

export default async function PortalHome() {
  if (!newLayoutEnabled()) return <LegacyPortalHome />;
  const { user, features } = await requireOperator();
  if (!features.includes("portal.dashboard")) {
    return (
      <div>
        <PageHeader eyebrow="Your portal" title="Your portal" description="The business dashboard isn't enabled for your business. Contact the programme team if you need it." />
      </div>
    );
  }
  const canSignal = features.includes("portal.signals") && can(user, "portal.signals");
  const actor = { id: user.id, role: user.role, operatorId: user.operatorId };
  return <OverviewView actor={actor} basePath="/portal" greetName={user.name.split(" ")[0]} signalAction={canSignal ? submitSignal : undefined} />;
}
