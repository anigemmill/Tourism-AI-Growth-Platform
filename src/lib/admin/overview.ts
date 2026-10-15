// Aggregates for the Super Admin dashboard and billing overview.

import "server-only";
import { prisma } from "@/lib/prisma";
import { invoiceBalance, paymentTotals } from "@/lib/billing/calc";
import type { BillingInterval } from "@/generated/prisma";

const MONTHS: Record<BillingInterval, number | null> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12, ONE_OFF: null };

export async function billingOverview() {
  const since90 = new Date(Date.now() - 90 * 86_400_000);
  const now = new Date();
  const [subs, open, recent] = await Promise.all([
    prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }, select: { amountCents: true, currency: true, interval: true, status: true } }),
    prisma.invoice.findMany({ where: { status: "OPEN" }, include: { transactions: true } }),
    prisma.billingTransaction.findMany({ where: { occurredAt: { gte: since90 } }, select: { kind: true, status: true, amountCents: true, source: true, currency: true } }),
  ]);
  const nzdRecent = recent.filter((t) => t.currency === "NZD");
  const totals = paymentTotals(nzdRecent);
  const balances = open.filter((i) => i.currency === "NZD").map((i) => ({ i, bal: invoiceBalance(i, i.transactions) }));
  return {
    activeSubscriptions: subs.filter((s) => s.status !== "PAST_DUE").length,
    pastDueSubscriptions: subs.filter((s) => s.status === "PAST_DUE").length,
    monthlyRecurringCents: Math.round(
      subs.filter((s) => s.currency === "NZD" && s.status === "ACTIVE" && MONTHS[s.interval]).reduce((sum, s) => sum + s.amountCents / MONTHS[s.interval]!, 0)
    ),
    openInvoices: open.length,
    overdueInvoices: open.filter((i) => i.dueAt && i.dueAt < now && invoiceBalance(i, i.transactions) > 0).length,
    outstandingCents: balances.reduce((s, b) => s + Math.max(0, b.bal), 0),
    failedPayments90d: recent.filter((t) => t.kind === "PAYMENT" && t.status === "FAILED").length,
    providerConfirmed90dCents: totals.providerConfirmedCents,
    manual90dCents: totals.manuallyRecordedCents,
  };
}

export async function accountOverview() {
  const [users, businesses] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: true }),
    prisma.operator.groupBy({ by: ["accountStatus"], _count: true }),
  ]);
  const u = (s: string) => users.find((r) => r.status === s)?._count ?? 0;
  const b = (s: string) => businesses.find((r) => r.accountStatus === s)?._count ?? 0;
  return {
    users: { total: users.reduce((n, r) => n + r._count, 0), active: u("ACTIVE"), pending: u("PENDING"), suspended: u("SUSPENDED"), archived: u("ARCHIVED") },
    businesses: { total: businesses.reduce((n, r) => n + r._count, 0), active: b("ACTIVE"), pending: b("PENDING"), suspended: b("SUSPENDED"), archived: b("ARCHIVED") },
  };
}

/** Failed sign-ins in the last 24 hours and emails currently locked out. */
export async function signInSnapshot() {
  const [failed24h, locked] = await Promise.all([
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.loginAttempt.groupBy({ by: ["email"], where: { success: false, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } }, _count: true, having: { email: { _count: { gte: 8 } } } }),
  ]);
  return { failed24h, lockedAccounts: locked.length };
}

export const SECURITY_ACTIONS = [
  "user.invite", "user.invite_revoked", "user.suspend", "user.deactivate", "user.reactivate", "user.role_change",
  "permission.user_change", "permission.role_change", "password.reset", "password.reset_sent", "password.change",
  "session.revoke_all", "business.status", "setup", "recovery.reset_link", "recovery.promote",
];
