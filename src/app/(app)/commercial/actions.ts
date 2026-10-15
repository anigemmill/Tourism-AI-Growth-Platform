"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const dealSchema = z.object({
  title: f.str(),
  organisation: f.str(),
  operatorId: f.optId(),
  type: z.enum(["PARTICIPATION_FEE", "SPONSORSHIP", "IMPLEMENTATION", "RECURRING_SERVICE", "LICENSING", "OTHER"]),
  stage: z.enum(["OPPORTUNITY", "PROPOSED", "QUOTED", "CONTRACTED", "LOST"]),
  oneOffValueNzd: z.coerce.number().min(0).default(0),
  monthlyValueNzd: z.coerce.number().min(0).default(0),
  termMonths: z.coerce.number().int().min(0).max(120).default(0),
  probability: z.coerce.number().int().min(0).max(100).default(25),
  expectedCloseDate: f.optDate(),
  contractSignedAt: f.optDate(),
  renewalDate: f.optDate(),
  notes: f.optStr(),
});

function dealRules(d: z.infer<typeof dealSchema>): string | null {
  if (d.stage === "CONTRACTED" && !d.contractSignedAt) return "Record the contract signature date before marking a deal contracted.";
  if (d.monthlyValueNzd > 0 && d.termMonths === 0) return "Set a term (months) for recurring value.";
  return null;
}

export async function createDeal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  const parsed = parseForm(dealSchema, fd);
  if (parsed.error) return parsed.error;
  const err = dealRules(parsed.data);
  if (err) return { error: err };
  return guarded(async () => {
    const d = await prisma.deal.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "deal", d.id, `Deal: ${d.title} (${d.stage})`);
    revalidatePath("/commercial");
    return { ok: "Deal added" };
  });
}

export async function updateDeal(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  const parsed = parseForm(dealSchema, fd);
  if (parsed.error) return parsed.error;
  const err = dealRules(parsed.data);
  if (err) return { error: err };
  return guarded(async () => {
    const before = await prisma.deal.findUniqueOrThrow({ where: { id } });
    const data = nullify(parsed.data);
    await prisma.deal.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "deal", id, `Deal updated${before.stage !== data.stage ? `: ${before.stage} → ${data.stage}` : ""}`, diff(before, data));
    revalidatePath(`/commercial/deals/${id}`);
    revalidatePath("/commercial");
    return { ok: "Saved" };
  });
}

export async function addPayment(dealId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  const parsed = parseForm(z.object({ amountNzd: z.coerce.number().positive(), receivedAt: f.date(), reference: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
    if (deal.stage !== "CONTRACTED") return { error: "Payments can only be recorded against contracted deals." };
    const p = await prisma.payment.create({ data: { dealId, amountNzd: parsed.data.amountNzd, receivedAt: parsed.data.receivedAt, reference: parsed.data.reference ?? null } });
    await audit(user.id, "create", "payment", p.id, `Payment received ${p.amountNzd} NZD`);
    revalidatePath(`/commercial/deals/${dealId}`);
    revalidatePath("/commercial");
    return { ok: "Payment recorded" };
  });
}

export async function addCost(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  const parsed = parseForm(
    z.object({
      description: f.str(), category: z.enum(["DELIVERY_LABOUR", "CONTRACTOR", "SOFTWARE", "TRAVEL", "VENUE", "OTHER"]),
      amountNzd: z.coerce.number().min(0), incurredAt: f.date(), isMonthly: f.bool(), isForecast: f.bool(), dealId: f.optId(), operatorId: f.optId(),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const c = await prisma.costItem.create({ data: nullify(parsed.data) as never });
    await audit(user.id, "create", "cost", c.id, `Cost: ${c.description} ${c.amountNzd} NZD`);
    revalidatePath("/commercial");
    return { ok: "Cost recorded" };
  });
}

const scenarioSchema = z.object({
  name: f.str(),
  cohortSize: z.coerce.number().int().min(1).max(500),
  feePerOperatorNzd: z.coerce.number().min(0),
  sponsorshipNzd: z.coerce.number().min(0).default(0),
  implementationAttachRate: z.coerce.number().min(0).max(100).transform((v) => v / 100),
  implementationAvgNzd: z.coerce.number().min(0).default(0),
  recurringAttachRate: z.coerce.number().min(0).max(100).transform((v) => v / 100),
  recurringMonthlyNzd: z.coerce.number().min(0).default(0),
  recurringMonths: z.coerce.number().int().min(0).max(60).default(12),
  deliveryHoursPerOperator: z.coerce.number().min(0).default(0),
  sharedDeliveryHours: z.coerce.number().min(0).default(0),
  hourlyCostNzd: z.coerce.number().min(0).default(0),
  softwareMonthlyNzd: z.coerce.number().min(0).default(0),
  programmeMonths: z.coerce.number().int().min(1).max(36).default(3),
  otherFixedCostsNzd: z.coerce.number().min(0).default(0),
  notes: f.optStr(),
});

export async function saveScenario(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  const parsed = parseForm(scenarioSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const data = { ...parsed.data, notes: parsed.data.notes ?? null };
    const s = id ? await prisma.pricingScenario.update({ where: { id }, data }) : await prisma.pricingScenario.create({ data });
    await audit(user.id, id ? "update" : "create", "pricing_scenario", s.id, `Scenario: ${s.name}`);
    revalidatePath("/commercial");
    return { ok: "Scenario saved" };
  });
}

export async function deleteScenario(id: string): Promise<ActionState> {
  const user = await requirePermission("commercial.edit");
  return guarded(async () => {
    const s = await prisma.pricingScenario.delete({ where: { id } });
    await audit(user.id, "delete", "pricing_scenario", id, `Deleted scenario ${s.name}`);
    revalidatePath("/commercial");
    return { ok: "Deleted" };
  });
}
