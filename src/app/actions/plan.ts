"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import type { ActionState } from "@/lib/forms";
import { PLAN_KINDS, setClientVisibility, type PlanKind } from "@/lib/plan/visibility";

/** Show a plan item to its business, or hide it again (staff, per-kind edit permission). */
export async function setClientVisibilityAction(kind: PlanKind, id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  if (!PLAN_KINDS.includes(kind)) return { error: "Unknown item type." };
  const r = await setClientVisibility(user, kind, id, fd.get("visible") === "true");
  if (!r.ok) return { error: r.error };
  revalidatePath("/", "layout");
  return { ok: r.message };
}
