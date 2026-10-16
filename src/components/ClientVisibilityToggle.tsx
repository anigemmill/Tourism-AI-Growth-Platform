// Per-item "shown to the client?" control for staff. Items start staff-only;
// "Show to client" publishes one to the business's portal.

import type { Visibility } from "@/generated/prisma";
import { ActionForm, Badge, VisibilityBadge } from "@/components/ui";
import { setClientVisibilityAction } from "@/app/actions/plan";
import type { PlanKind } from "@/lib/plan/visibility";

export function ClientVisibilityToggle({ kind, id, visibility, operatorId, editable = true }: {
  kind: PlanKind;
  id: string;
  visibility: Visibility;
  operatorId: string | null;
  editable?: boolean;
}) {
  // Programme-level items and wider sharing aren't switched here; show their
  // sharing as before.
  if (!operatorId || (visibility !== "INTERNAL" && visibility !== "CONFIDENTIAL")) return <VisibilityBadge v={visibility} />;
  const shown = visibility === "CONFIDENTIAL";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={shown ? "success" : "outline"}>{shown ? "Client can see" : "Staff only"}</Badge>
      {editable && (
        <ActionForm action={setClientVisibilityAction.bind(null, kind, id)} inline variant="ghost" submitLabel={shown ? "Hide from client" : "Show to client"}>
          <input type="hidden" name="visible" value={shown ? "false" : "true"} />
        </ActionForm>
      )}
    </span>
  );
}
