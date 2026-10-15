// Pure billing arithmetic in integer minor units (cents). See docs/BILLING.md.

import type { BillingSource, BillingTxnKind, BillingTxnStatus, InvoiceStatus } from "@/generated/prisma";

export interface TxnLike {
  kind: BillingTxnKind;
  status: BillingTxnStatus;
  amountCents: number;
  source: BillingSource;
}

/** Signed effect of a transaction on what the customer owes. */
export function balanceEffect(t: TxnLike): number {
  if (t.status !== "SUCCEEDED") return 0; // pending and failed attempts change nothing
  switch (t.kind) {
    case "PAYMENT": return -t.amountCents;
    case "CREDIT": return -t.amountCents;
    case "REFUND": return t.amountCents;
    case "CHARGE": return t.amountCents;
  }
}

export function invoiceBalance(invoice: { amountCents: number; status: InvoiceStatus }, txns: readonly TxnLike[]): number {
  if (invoice.status === "VOID" || invoice.status === "DRAFT") return 0;
  return invoice.amountCents + txns.reduce((sum, t) => sum + balanceEffect(t), 0);
}

export interface PaymentTotals {
  providerConfirmedCents: number;
  manuallyRecordedCents: number;
  refundedCents: number;
  failedCount: number;
  failedCents: number;
}

/** Splits received money by whether a payment provider confirmed it. */
export function paymentTotals(txns: readonly TxnLike[]): PaymentTotals {
  const out: PaymentTotals = { providerConfirmedCents: 0, manuallyRecordedCents: 0, refundedCents: 0, failedCount: 0, failedCents: 0 };
  for (const t of txns) {
    if (t.kind === "PAYMENT" && t.status === "FAILED") {
      out.failedCount += 1;
      out.failedCents += t.amountCents;
    }
    if (t.status !== "SUCCEEDED") continue;
    if (t.kind === "PAYMENT") {
      if (t.source === "PROVIDER") out.providerConfirmedCents += t.amountCents;
      else out.manuallyRecordedCents += t.amountCents;
    }
    if (t.kind === "REFUND") out.refundedCents += t.amountCents;
  }
  return out;
}

/** Parses "1,234.50" / "1234.5" / "$99" into cents; null if not a positive amount. */
export function parseAmountToCents(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

export function formatMoney(cents: number, currency = "NZD"): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency, currencyDisplay: "symbol" }).format(cents / 100) + (currency === "NZD" ? "" : ` ${currency}`);
}

export const CURRENCIES = ["NZD", "AUD", "USD", "GBP", "EUR"] as const;
