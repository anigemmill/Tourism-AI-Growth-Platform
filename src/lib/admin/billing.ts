// Billing administration. Everything recorded here is source MANUAL and is
// shown as "manually recorded" — it is never presented as provider-confirmed.
// PROVIDER records may only be written by a verified provider integration
// (none yet; see docs/BILLING.md). No card or payment credentials are stored.

import { prisma } from "@/lib/prisma";
import type { BillingInterval, BillingTxnKind, BillingTxnStatus, InvoiceStatus, SubscriptionStatus } from "@/generated/prisma";
import { audit } from "@/lib/audit";
import { formatMoney, invoiceBalance } from "@/lib/billing/calc";
import { INVOICE_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS, TXN_KIND_LABELS, TXN_STATUS_LABELS } from "@/lib/labels";
import { AdminError, type AdminActor, type AdminResult } from "./users";

function need(actor: AdminActor) {
  if (!actor.permissions.includes("billing.manage")) throw new AdminError("You don't have permission to change billing records.");
}

async function wrap(fn: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AdminError) return { ok: false, error: err.message };
    if ((err as { code?: string }).code === "P2002") return { ok: false, error: "That invoice number is already used." };
    throw err;
  }
}

async function event(operatorId: string, actorId: string, type: string, summary: string) {
  await prisma.billingEvent.create({ data: { operatorId, actorId, type, summary } });
}

/**
 * True if free text contains what looks like a payment card number (13–19
 * digits, optionally spaced/dashed, passing the Luhn check). Card numbers
 * must never be stored.
 */
export function looksLikeCardNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const m of text.matchAll(/\d(?:[ -]?\d){12,18}/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function noCardData(...texts: (string | null | undefined)[]) {
  if (texts.some(looksLikeCardNumber)) throw new AdminError("Don't enter card numbers or payment credentials. Use a reference such as the last 4 digits or a provider ID instead.");
}

export async function createSubscription(
  actor: AdminActor,
  operatorId: string,
  d: { plan: string; status: SubscriptionStatus; interval: BillingInterval; amountCents: number; currency: string; currentPeriodStart?: Date; renewalDate?: Date; providerCustomerRef?: string; notes?: string }
): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    noCardData(d.notes, d.providerCustomerRef);
    const s = await prisma.subscription.create({ data: { operatorId, ...d, source: "MANUAL" } });
    const summary = `Subscription “${d.plan}” recorded: ${formatMoney(d.amountCents, d.currency)} ${d.interval.toLowerCase()} (${SUBSCRIPTION_STATUS_LABELS[d.status]})`;
    await event(operatorId, actor.id, "subscription.created", summary);
    await audit(actor.id, "billing.subscription_create", "operator", operatorId, summary, { subscriptionId: s.id });
    return { ok: true, message: "Subscription recorded." };
  });
}

export async function updateSubscription(
  actor: AdminActor,
  subscriptionId: string,
  d: { status: SubscriptionStatus; renewalDate?: Date | null }
): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    const before = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: d.status, renewalDate: d.renewalDate ?? null, cancelledAt: d.status === "CANCELLED" ? before.cancelledAt ?? new Date() : null },
    });
    const summary = `Subscription “${before.plan}”: ${SUBSCRIPTION_STATUS_LABELS[before.status]} → ${SUBSCRIPTION_STATUS_LABELS[d.status]}`;
    await event(before.operatorId, actor.id, "subscription.updated", summary);
    await audit(actor.id, "billing.subscription_update", "operator", before.operatorId, summary, {
      status: { from: before.status, to: d.status }, renewalDate: { from: before.renewalDate?.toISOString() ?? null, to: d.renewalDate?.toISOString() ?? null },
    });
    return { ok: true, message: "Subscription updated." };
  });
}

export async function createInvoice(
  actor: AdminActor,
  operatorId: string,
  d: { number: string; amountCents: number; currency: string; issuedAt: Date; dueAt?: Date; status: InvoiceStatus; subscriptionId?: string; providerRef?: string; notes?: string }
): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    noCardData(d.notes, d.providerRef);
    if (d.subscriptionId) {
      const s = await prisma.subscription.findUnique({ where: { id: d.subscriptionId }, select: { operatorId: true } });
      // A subscription from another business can't be attached by editing the form.
      if (s?.operatorId !== operatorId) throw new AdminError("That subscription belongs to a different business.");
    }
    const inv = await prisma.invoice.create({ data: { operatorId, ...d, source: "MANUAL" } });
    const summary = `Invoice ${d.number} recorded: ${formatMoney(d.amountCents, d.currency)} (${INVOICE_STATUS_LABELS[d.status]})`;
    await event(operatorId, actor.id, "invoice.created", summary);
    await audit(actor.id, "billing.invoice_create", "operator", operatorId, summary, { invoiceId: inv.id });
    return { ok: true, message: `Invoice ${d.number} recorded.` };
  });
}

export async function setInvoiceStatus(actor: AdminActor, invoiceId: string, status: InvoiceStatus): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (inv.source === "PROVIDER") throw new AdminError("Provider-issued invoices are updated by the provider, not here.");
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
    const summary = `Invoice ${inv.number}: ${INVOICE_STATUS_LABELS[inv.status]} → ${INVOICE_STATUS_LABELS[status]}`;
    await event(inv.operatorId, actor.id, "invoice.status", summary);
    await audit(actor.id, "billing.invoice_status", "operator", inv.operatorId, summary, { invoiceId, status: { from: inv.status, to: status } });
    return { ok: true, message: summary };
  });
}

/**
 * Records a payment, refund or adjustment entered by an administrator.
 * Always MANUAL. A succeeded payment that clears an open invoice marks it paid.
 */
export async function recordTransaction(
  actor: AdminActor,
  operatorId: string,
  d: {
    kind: BillingTxnKind; status: BillingTxnStatus; amountCents: number; currency: string; occurredAt: Date;
    invoiceId?: string; method?: string; reference?: string; failureReason?: string; note?: string;
  }
): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    if (!(d.amountCents > 0)) throw new AdminError("Enter an amount greater than zero.");
    noCardData(d.method, d.reference, d.failureReason, d.note);
    if ((d.kind === "CREDIT" || d.kind === "CHARGE" || d.kind === "REFUND") && !d.note?.trim()) throw new AdminError("Add a note explaining this adjustment or refund.");
    let invoice = null;
    if (d.invoiceId) {
      invoice = await prisma.invoice.findUnique({ where: { id: d.invoiceId }, include: { transactions: true } });
      if (invoice?.operatorId !== operatorId) throw new AdminError("That invoice belongs to a different business.");
      if (invoice.currency !== d.currency) throw new AdminError(`Use the invoice currency (${invoice.currency}).`);
    }
    const txn = await prisma.billingTransaction.create({
      data: {
        operatorId, invoiceId: d.invoiceId ?? null, kind: d.kind, status: d.status, amountCents: d.amountCents, currency: d.currency,
        occurredAt: d.occurredAt, method: d.method ?? null, providerTransactionRef: d.reference ?? null,
        failureReason: d.status === "FAILED" ? d.failureReason ?? null : null, note: d.note ?? null, source: "MANUAL", recordedById: actor.id,
      },
    });
    let extra = "";
    if (invoice && invoice.status === "OPEN" && d.status === "SUCCEEDED") {
      const balance = invoiceBalance(invoice, [...invoice.transactions, txn]);
      if (balance <= 0) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
        extra = `; invoice ${invoice.number} marked paid`;
      }
    }
    const summary = `${TXN_KIND_LABELS[d.kind]} of ${formatMoney(d.amountCents, d.currency)} manually recorded (${TXN_STATUS_LABELS[d.status]})${invoice ? ` against ${invoice.number}` : ""}${extra}`;
    await event(operatorId, actor.id, `transaction.${d.kind.toLowerCase()}`, summary);
    await audit(actor.id, d.kind === "PAYMENT" ? "billing.payment_record" : "billing.adjustment", "operator", operatorId, summary, {
      transactionId: txn.id, kind: d.kind, status: d.status, amountCents: d.amountCents, currency: d.currency, source: "MANUAL",
    });
    return { ok: true, message: `${TXN_KIND_LABELS[d.kind]} recorded as manually entered (not provider-confirmed)${extra}.` };
  });
}

export async function addBillingNote(actor: AdminActor, operatorId: string, note: string): Promise<AdminResult> {
  return wrap(async () => {
    need(actor);
    noCardData(note);
    await event(operatorId, actor.id, "note", note);
    await audit(actor.id, "billing.note", "operator", operatorId, "Billing note added");
    return { ok: true, message: "Note added." };
  });
}
