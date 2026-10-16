"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";
import { activeProgramme } from "@/lib/queries";
import { getBrand } from "@/lib/brand";

const operatorSchema = z.object({
  name: f.str(),
  category: f.str(),
  status: z.enum(["PROSPECT", "INVITED", "ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"]),
  contactName: f.optStr(),
  contactEmail: f.email(),
  contactPhone: f.optStr(),
  websiteUrl: f.url(),
  bookingUrl: f.url(),
  experiences: f.optStr(),
  targetMarkets: f.list(),
  marketingChannels: f.list(),
  bookingProcess: f.optStr(),
  techStack: f.list(),
  objectives: f.optStr(),
  challenges: f.optStr(),
  aiMaturity: f.optInt(1, 5),
  seasonality: f.optStr(),
  groupTags: f.list(),
  internalNotes: f.optStr(),
});

const governanceSchema = z.object({
  agreedScope: f.optStr(),
  dataAgreementSignedAt: f.optDate(),
  consentCohortSharing: f.bool(),
  consentAggregate: f.bool(),
  consentCaseStudy: f.bool(),
  dataRetentionNotes: f.optStr(),
  culturalGuidance: f.optStr(),
});

export async function createOperator(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(operatorSchema, fd);
  if (parsed.error) return parsed.error;
  let id = "";
  const res = await guarded(async () => {
    // Pilot businesses join the active cohort programme. Findable clients
    // don't: a programme brings the shared directory and workshops with it.
    const programme = getBrand().id === "findable" ? null : await activeProgramme();
    const op = await prisma.operator.create({ data: { ...nullify(parsed.data), programmeId: programme?.id ?? null } as never });
    id = op.id;
    await audit(user.id, "create", "operator", op.id, `Created operator ${op.name}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  revalidatePath("/operators");
  redirect(`/operators/${id}`);
}

export async function updateOperator(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(operatorSchema, fd);
  if (parsed.error) return parsed.error;
  const res = await guarded(async () => {
    const before = await prisma.operator.findUniqueOrThrow({ where: { id } });
    const data = nullify(parsed.data);
    await prisma.operator.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "operator", id, `Updated operator ${data.name}`, diff(before, data));
    return { ok: "Saved" };
  });
  if (res?.error) return res;
  revalidatePath(`/operators/${id}`);
  redirect(`/operators/${id}`);
}

export async function updateGovernance(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(governanceSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const before = await prisma.operator.findUniqueOrThrow({ where: { id } });
    const data = nullify(parsed.data);
    await prisma.operator.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "operator.governance", id, "Updated permissions & data-sharing", diff(before, data));
    revalidatePath(`/operators/${id}`);
    return { ok: "Permissions saved" };
  });
}

export async function startAssessment(operatorId: string): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  let id = "";
  const res = await guarded(async () => {
    const a = await prisma.assessment.create({
      data: {
        operatorId,
        status: "IN_PROGRESS",
        conductedBy: user.name,
        conductedAt: new Date(),
        areas: {
          create: [
            "AI_SEARCH_VISIBILITY", "MARKETING_CONTENT", "ENQUIRIES_CONVERSION", "BOOKING_JOURNEY", "GUEST_COMMUNICATIONS",
            "ADMIN_WORKLOAD", "REPORTING_DECISIONS", "OPERATIONS", "FEEDBACK_PRODUCT",
          ].map((area) => ({ area: area as never })),
        },
      },
    });
    id = a.id;
    await audit(user.id, "create", "assessment", a.id, "Started assessment");
    return { ok: "Started" };
  });
  if (res?.error) return res;
  redirect(`/assessments/${id}`);
}
