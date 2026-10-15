# Billing

## What exists now

The data model and admin screens (Administration → Billing, and each
business's page) cover:

- **Subscriptions:** plan, status, billing period, amount, current period
  and renewal date, and a customer reference.
- **Invoices:** number, amount, currency, issue and due dates, and status
  (draft, open, paid, void, uncollectible). The balance is calculated from
  transactions.
- **Transactions:** payments, refunds, credit adjustments and charge
  adjustments, each with a date, amount, currency, status (pending,
  succeeded or failed), method, reference and failure reason.
- **Billing events and admin notes:** a timeline for each business.
- **Summaries:** active subscriptions, monthly recurring amount, outstanding
  and overdue invoices, failed payments, and money received, with
  provider-confirmed and manually recorded totals kept separate.

Amounts are stored as integer cents. Database checks reject non-positive
transaction amounts.

## Manual vs provider-confirmed

Every record has a `source`:

- `MANUAL`: entered by an administrator. Labelled "Manually recorded"
  everywhere, and never presented as confirmed.
- `PROVIDER`: confirmed by a payment provider. The UI can't create these.
  Only a verified provider integration may write them.

**No payment provider is integrated yet**, so every record today is
`MANUAL`. Nothing is seeded or fabricated: billing screens start empty.

Card numbers and payment credentials are never stored:

- The schema has no fields for them.
- Free-text fields reject anything that looks like a card number
  (13–19 digits that pass the Luhn check).

Recording a transaction needs the `billing.manage` permission and a
confirmation tick. Refunds and adjustments need a note. Every change is
written to the audit log and the business's billing timeline.

## Proposed provider integration (not built)

Recommended: **Stripe**. It supports NZD, Billing (subscriptions and
invoices) and hosted Checkout / Customer Portal, so card data never touches
this app.

1. Create Stripe customers and subscriptions from a business's page. Store
   `providerCustomerRef` / `providerSubscriptionRef`.
2. Add a webhook route (`/api/billing/stripe`). It verifies the
   `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET` and is
   idempotent on the event id. It handles `invoice.*`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `charge.refunded` and `customer.subscription.*`.
3. Write `source = PROVIDER` records from verified events only, with the
   provider transaction reference.
4. Send operators to Stripe's hosted pages to pay and update cards.

This needs a decision on plans and pricing, a Stripe account, and two new
secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). It is a separate
change and has not been built.
