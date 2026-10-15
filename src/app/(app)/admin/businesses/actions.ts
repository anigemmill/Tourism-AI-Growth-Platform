"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { guarded } from "@/lib/actions";
import { confirmed, NOT_CONFIRMED, type ActionState } from "@/lib/forms";
import type { AdminResult } from "@/lib/admin/users";
import * as biz from "@/lib/admin/businesses";
import * as billing from "@/lib/admin/billing";
import { CURRENCIES, parseAmountToCents } from "@/lib/billing/calc";

const path = (id: string) => `/admin/businesses/${id}`;

function done(r: AdminResult, ...paths: string[]): ActionState {
  for (const p of paths) revalidatePath(p);
  return r.ok ? { ok: r.message } : { error: r.error };
}

const optDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());
const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const money = z.string().transform((v, ctx) => {
  const c = parseAmountToCents(v);
  if (c === null) ctx.addIssue({ code: "custom", message: "Enter an amount such as 1250 or 1250.00" });
  return c ?? 0;
});
const currency = z.enum(CURRENCIES);

function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): { data: z.infer<T> } | { error: ActionState } {
  const r = schema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: { error: `Please check the form: ${String(r.error.issues[0].path[0] ?? "")} — ${r.error.issues[0].message}` } };
  return { data: r.data };
}

export async function setAccountStatus(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("businesses.manage");
  const s = z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]).safeParse(fd.get("status"));
  if (!s.success) return { error: "Choose a status." };
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await biz.setAccountStatus(actor, operatorId, s.data), path(operatorId), "/admin/businesses", "/admin"));
}

export async function setFeature(operatorId: string, feature: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("businesses.manage");
  return guarded(async () => done(await biz.setFeature(actor, operatorId, feature, fd.get("enabled") === "true"), path(operatorId)));
}

export async function setProgramme(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("businesses.manage");
  const programmeId = String(fd.get("programmeId") ?? "") || null;
  const cohort = String(fd.get("cohort") ?? "").trim().slice(0, 80) || null;
  return guarded(async () => done(await biz.setProgramme(actor, operatorId, programmeId, cohort), path(operatorId)));
}

// ---------------------------------------------------------------------------
// Billing (manual records only)
// ---------------------------------------------------------------------------

export async function createSubscription(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const p = parse(
    z.object({
      plan: z.string().trim().min(1, "Required").max(80),
      status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED", "CANCELLED"]),
      interval: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_OFF"]),
      amount: money, currency, currentPeriodStart: optDate, renewalDate: optDate,
      providerCustomerRef: optText(120), notes: optText(2000),
    }),
    fd
  );
  if ("error" in p) return p.error;
  const { amount, ...d } = p.data;
  return guarded(async () => done(await billing.createSubscription(actor, operatorId, { ...d, amountCents: amount }), path(operatorId), "/admin/billing"));
}

export async function updateSubscription(operatorId: string, subscriptionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const p = parse(z.object({ status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED", "CANCELLED"]), renewalDate: optDate }), fd);
  if ("error" in p) return p.error;
  if (p.data.status === "CANCELLED" && !confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await billing.updateSubscription(actor, subscriptionId, p.data), path(operatorId), "/admin/billing"));
}

export async function createInvoice(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const p = parse(
    z.object({
      number: z.string().trim().min(1, "Required").max(40),
      amount: z.string().transform((v, ctx) => {
        const c = v.trim() === "0" ? 0 : parseAmountToCents(v);
        if (c === null) ctx.addIssue({ code: "custom", message: "Enter an amount such as 1250.00" });
        return c ?? 0;
      }),
      currency, issuedAt: z.coerce.date(), dueAt: optDate,
      status: z.enum(["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"]),
      subscriptionId: optText(64), providerRef: optText(120), notes: optText(2000),
    }),
    fd
  );
  if ("error" in p) return p.error;
  const { amount, ...d } = p.data;
  return guarded(async () => done(await billing.createInvoice(actor, operatorId, { ...d, amountCents: amount }), path(operatorId), "/admin/billing"));
}

export async function setInvoiceStatus(operatorId: string, invoiceId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const s = z.enum(["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"]).safeParse(fd.get("status"));
  if (!s.success) return { error: "Choose a status." };
  if (!confirmed(fd)) return NOT_CONFIRMED;
  return guarded(async () => done(await billing.setInvoiceStatus(actor, invoiceId, s.data), path(operatorId), "/admin/billing"));
}

export async function recordTransaction(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const p = parse(
    z.object({
      kind: z.enum(["PAYMENT", "REFUND", "CREDIT", "CHARGE"]),
      status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]),
      amount: money, currency, occurredAt: z.coerce.date(),
      invoiceId: optText(64), method: optText(60), reference: optText(120), failureReason: optText(300), note: optText(2000),
    }),
    fd
  );
  if ("error" in p) return p.error;
  if (!confirmed(fd)) return NOT_CONFIRMED;
  const { amount, ...d } = p.data;
  return guarded(async () => done(await billing.recordTransaction(actor, operatorId, { ...d, amountCents: amount }), path(operatorId), "/admin/billing", "/admin"));
}

export async function addBillingNote(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("billing.manage");
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  if (!note) return { error: "Write a note first." };
  return guarded(async () => done(await billing.addBillingNote(actor, operatorId, note), path(operatorId)));
}
