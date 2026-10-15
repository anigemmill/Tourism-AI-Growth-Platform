"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { guarded } from "@/lib/actions";
import { confirmed, NOT_CONFIRMED, type ActionState } from "@/lib/forms";
import { setRolePermissionSet } from "@/lib/admin/users";

export async function saveRolePermissions(role: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.roles");
  const r = z.enum(["ADMIN", "PROGRAMME_MANAGER", "ANALYST", "OPERATOR"]).safeParse(role);
  if (!r.success) return { error: "That role can't be configured." };
  if (!confirmed(fd)) return NOT_CONFIRMED;
  const wanted = fd.getAll("permissions").map(String);
  return guarded(async () => {
    const res = await setRolePermissionSet(actor, r.data, wanted);
    revalidatePath("/admin/access");
    return res.ok ? { ok: res.message } : { error: res.error };
  });
}
