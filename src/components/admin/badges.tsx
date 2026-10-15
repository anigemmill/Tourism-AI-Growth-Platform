import { Badge } from "@/components/ui";
import type { BillingSource, BusinessAccountStatus, InvoiceStatus, SubscriptionStatus, UserRole, UserStatus, BillingTxnStatus } from "@/generated/prisma";
import {
  ACCOUNT_STATUS_LABELS, BILLING_SOURCE_LABELS, INVOICE_STATUS_LABELS, ROLE_LABELS, SUBSCRIPTION_STATUS_LABELS, TXN_STATUS_LABELS, USER_STATUS_LABELS,
} from "@/lib/labels";

const userTone: Record<UserStatus, string> = { PENDING: "info", ACTIVE: "success", SUSPENDED: "warning", ARCHIVED: "outline" };
const roleTone: Record<UserRole, string> = { FOUNDER: "accent", ADMIN: "info", PROGRAMME_MANAGER: "brand", ANALYST: "neutral", OPERATOR: "neutral" };
const acctTone: Record<BusinessAccountStatus, string> = { PENDING: "info", ACTIVE: "success", SUSPENDED: "warning", ARCHIVED: "outline" };
const subTone: Record<SubscriptionStatus, string> = { TRIALING: "info", ACTIVE: "success", PAST_DUE: "danger", PAUSED: "warning", CANCELLED: "outline" };
const invTone: Record<InvoiceStatus, string> = { DRAFT: "outline", OPEN: "warning", PAID: "success", VOID: "outline", UNCOLLECTIBLE: "danger" };
const txnTone: Record<BillingTxnStatus, string> = { PENDING: "info", SUCCEEDED: "success", FAILED: "danger" };

export const UserStatusBadge = ({ s }: { s: UserStatus }) => <Badge tone={userTone[s]}>{USER_STATUS_LABELS[s]}</Badge>;
export const RoleBadge = ({ r }: { r: UserRole }) => <Badge tone={roleTone[r]}>{ROLE_LABELS[r]}</Badge>;
export const AccountStatusBadge = ({ s }: { s: BusinessAccountStatus }) => <Badge tone={acctTone[s]}>{ACCOUNT_STATUS_LABELS[s]}</Badge>;
export const SubscriptionBadge = ({ s }: { s: SubscriptionStatus }) => <Badge tone={subTone[s]}>{SUBSCRIPTION_STATUS_LABELS[s]}</Badge>;
export const InvoiceBadge = ({ s }: { s: InvoiceStatus }) => <Badge tone={invTone[s]}>{INVOICE_STATUS_LABELS[s]}</Badge>;
export const TxnStatusBadge = ({ s }: { s: BillingTxnStatus }) => <Badge tone={txnTone[s]}>{TXN_STATUS_LABELS[s]}</Badge>;
/** Every money record shows where it came from. */
export const SourceBadge = ({ s }: { s: BillingSource }) =>
  s === "PROVIDER" ? <Badge tone="success" title="Confirmed by the payment provider">{BILLING_SOURCE_LABELS[s]}</Badge>
  : <Badge tone="outline" title="Entered by an administrator; not confirmed by a payment provider">{BILLING_SOURCE_LABELS[s]}</Badge>;

export const adminDate = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeZone: "Pacific/Auckland" });
export const adminDateTime = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Pacific/Auckland" });
export const fmtDate = (d: Date | null | undefined) => (d ? adminDate.format(d) : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? adminDateTime.format(d) : "—");
