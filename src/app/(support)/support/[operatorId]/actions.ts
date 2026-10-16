"use server";

// Client view (Super Admin acting for a client). Every action re-resolves the
// signed-in Super Admin from the session; the core functions then check the
// role, the edit grant (this admin + this session + this business, not
// expired or revoked) and the existing permission before changing anything.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guarded } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { confirmed, NOT_CONFIRMED, parseForm, type ActionState } from "@/lib/forms";
import {
  businessDetailsSchema, enterEditMode, leaveEditMode, supportBusiness, SupportAccessError, teamAction, TEAM_ACTIONS,
  updateBusinessDetails, type SupportResult, type TeamAction,
} from "@/lib/support/core";
import { requireSupportAdmin } from "@/lib/support/session";

const refresh = (operatorId: string) => revalidatePath(`/support/${operatorId}`, "layout");
const toState = (r: SupportResult): ActionState => (r.ok ? { ok: r.message, link: r.link } : { error: r.error });

export async function enterEditModeAction(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSupportAdmin();
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => {
    try {
      await enterEditMode(admin, operatorId);
    } catch (err) {
      if (err instanceof SupportAccessError) return { error: err.message };
      throw err;
    }
    refresh(operatorId);
    return { ok: "Edit mode is on for 30 minutes." };
  });
}

export async function leaveEditModeAction(operatorId: string): Promise<ActionState> {
  const admin = await requireSupportAdmin();
  return guarded(async () => {
    await leaveEditMode(admin, operatorId, "left");
    refresh(operatorId);
    return { ok: "Edit mode is off." };
  });
}

/** Ends edit mode (if on), records the exit and returns to the back office. */
export async function exitClientViewAction(operatorId: string): Promise<ActionState> {
  const admin = await requireSupportAdmin();
  const business = await supportBusiness(operatorId);
  await leaveEditMode(admin, operatorId, "exit");
  if (business) await audit(admin.id, "support.exit", "operator", business.id, `Left the client view of ${business.name}`);
  redirect(business ? `/admin/businesses/${business.id}` : "/admin/businesses");
}

export async function updateBusinessDetailsAction(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSupportAdmin();
  const parsed = parseForm(businessDetailsSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const r = await updateBusinessDetails(admin, operatorId, parsed.data);
    if (r.ok) refresh(operatorId);
    return toState(r);
  });
}

export async function teamActionAction(operatorId: string, userId: string, action: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSupportAdmin();
  if (!TEAM_ACTIONS.includes(action as TeamAction)) return { error: "Unknown action." };
  if ((action === "suspend" || action === "reactivate") && !confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => {
    const r = await teamAction(admin, operatorId, userId, action as TeamAction);
    if (r.ok) refresh(operatorId);
    return toState(r);
  });
}
