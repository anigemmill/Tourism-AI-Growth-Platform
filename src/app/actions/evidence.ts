"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import type { Permission } from "@/lib/rbac/permissions";

const EDIT_PERMISSION: Record<string, Permission> = {
  opportunity: "opportunities.edit",
  experiment: "experiments.edit",
  project: "work.edit",
};
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, type ActionState } from "@/lib/forms";

const schema = z.object({
  kind: z.enum(["OBSERVED", "OPERATOR_REPORTED", "MEASURED", "THIRD_PARTY", "HYPOTHESIS"]),
  description: f.str(),
  reference: f.optStr(),
  observedAt: f.optDate(),
  visibility: z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]).default("CONFIDENTIAL"),
});

export async function addEvidence(
  target: { entityType: string; entityId: string; operatorId: string | null; path: string },
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = await requirePermission(EDIT_PERMISSION[target.entityType] ?? "operators.edit");
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const e = await prisma.evidence.create({
      data: {
        entityType: target.entityType,
        entityId: target.entityId,
        operatorId: target.operatorId,
        kind: parsed.data.kind,
        description: parsed.data.description,
        reference: parsed.data.reference ?? null,
        observedAt: parsed.data.observedAt ?? null,
        visibility: parsed.data.visibility,
        recordedBy: user.name,
      },
    });
    await audit(user.id, "create", "evidence", e.id, `Evidence added to ${target.entityType}`);
    revalidatePath(target.path);
    return { ok: "Evidence recorded" };
  });
}
