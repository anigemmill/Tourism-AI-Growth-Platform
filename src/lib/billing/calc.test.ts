import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, invoiceBalance, parseAmountToCents, paymentTotals } from "./calc";
import { looksLikeCardNumber } from "../admin/billing";

const t = (kind: "PAYMENT" | "REFUND" | "CREDIT" | "CHARGE", status: "PENDING" | "SUCCEEDED" | "FAILED", amountCents: number, source: "MANUAL" | "PROVIDER" = "MANUAL") => ({ kind, status, amountCents, source });

test("invoice balance counts only succeeded transactions", () => {
  const inv = { amountCents: 10000, status: "OPEN" as const };
  assert.equal(invoiceBalance(inv, []), 10000);
  assert.equal(invoiceBalance(inv, [t("PAYMENT", "FAILED", 10000), t("PAYMENT", "PENDING", 10000)]), 10000);
  assert.equal(invoiceBalance(inv, [t("PAYMENT", "SUCCEEDED", 6000), t("CREDIT", "SUCCEEDED", 1000), t("CHARGE", "SUCCEEDED", 500), t("REFUND", "SUCCEEDED", 200)]), 3700);
  assert.equal(invoiceBalance({ amountCents: 10000, status: "VOID" }, []), 0);
});

test("payment totals keep provider-confirmed and manual money apart", () => {
  const r = paymentTotals([t("PAYMENT", "SUCCEEDED", 500, "PROVIDER"), t("PAYMENT", "SUCCEEDED", 300), t("PAYMENT", "FAILED", 900), t("REFUND", "SUCCEEDED", 100)]);
  assert.deepEqual(r, { providerConfirmedCents: 500, manuallyRecordedCents: 300, refundedCents: 100, failedCount: 1, failedCents: 900 });
});

test("amount parsing is exact and rejects junk", () => {
  assert.equal(parseAmountToCents("1,250.50"), 125050);
  assert.equal(parseAmountToCents("$99"), 9900);
  assert.equal(parseAmountToCents("0.1"), 10);
  for (const bad of ["", "0", "-5", "1.234", "abc", "1e5", "12345678901"]) assert.equal(parseAmountToCents(bad), null, bad);
  assert.equal(formatMoney(125050), "$1,250.50");
});

test("card numbers are detected (Luhn) without flagging ordinary references", () => {
  assert.ok(looksLikeCardNumber("paid with 4242 4242 4242 4242"));
  assert.ok(looksLikeCardNumber("5555-5555-5555-4444"));
  assert.ok(!looksLikeCardNumber("INV-2026-0001"));
  assert.ok(!looksLikeCardNumber("bank ref 12-3456-7890123-00"));
  assert.ok(!looksLikeCardNumber("last 4: 4242"));
  assert.ok(!looksLikeCardNumber(null));
});
