"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { can } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, type ActionState } from "@/lib/forms";

const schema = z.object({
  type: z.enum(["DEMAND", "ENQUIRY", "REVIEW", "OPERATIONS", "MARKET"]),
  title: f.str(),
  summary: f.str(),
});

/** Operators tell us what they're seeing. Always attributed to their own business. */
export async function submitSignal(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireOperatorFeature("portal.signals");
  if (!can(user, "portal.signals")) return { error: "Your account can't submit updates." };
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const s = await prisma.signal.create({
      data: {
        operatorId: user.operatorId!, // from the session, never from the form
        type: parsed.data.type, title: parsed.data.title, summary: parsed.data.summary,
        claimType: "OBSERVATION", source: `Operator (${user.name})`, sourceTimestamp: new Date(),
        confidence: "MEDIUM", submittedByOperator: true, visibility: "CONFIDENTIAL", createdBy: user.name,
      },
    });
    await audit(user.id, "create", "signal", s.id, "Operator submitted an update");
    revalidatePath("/portal");
    return { ok: "Thanks — your programme lead will see this." };
  });
}
