import Link from "next/link";
import { Card, PageHeader, Progress, Stat, Table } from "@/components/ui";
import { fmtDateTime } from "@/components/admin/badges";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { accountOverview, billingOverview, SECURITY_ACTIONS, signInSnapshot } from "@/lib/admin/overview";
import { formatMoney } from "@/lib/billing/calc";
import { OPERATOR_STATUS_LABELS } from "@/lib/labels";
import type { OperatorStatus } from "@/generated/prisma";

const STAGES: OperatorStatus[] = ["PROSPECT", "INVITED", "ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"];

export default async function AdminDashboard() {
  const me = await requirePermission("admin.dashboard");
  const [accounts, billing, stages, recent, security, signIns, onboarding] = await Promise.all([
    accountOverview(),
    can(me, "billing.view") ? billingOverview() : null,
    prisma.operator.groupBy({ by: ["status"], where: { isSynthetic: false }, _count: true }),
    prisma.auditLog.findMany({ where: { action: { notIn: ["login"] } }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
    prisma.auditLog.findMany({ where: { action: { in: SECURITY_ACTIONS } }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
    signInSnapshot(),
    prisma.operator.findMany({
      where: { isSynthetic: false, accountStatus: { not: "ARCHIVED" } },
      select: { dataAgreementSignedAt: true, programmeId: true, contactEmail: true, profile: { select: { id: true } }, _count: { select: { members: true, assessments: true } } },
    }),
  ]);
  const stageCount = (s: OperatorStatus) => stages.find((r) => r.status === s)?._count ?? 0;
  const totalOps = stages.reduce((n, r) => n + r._count, 0);
  const onboarded = onboarding.filter((o) => o.dataAgreementSignedAt && o._count.members > 0 && o._count.assessments > 0).length;

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Super Admin" emphasis="overview" description="Accounts, businesses, billing, programme progress and security at a glance." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={accounts.users.total} sub={`${accounts.users.active} active`} href="/admin/users" variant="night" />
        <Stat label="Active businesses" value={accounts.businesses.active} sub={`${accounts.businesses.total} in total`} href="/admin/businesses?account=ACTIVE" variant="forest" />
        <Stat label="Pending invitations" value={accounts.users.pending} href="/admin/users?status=PENDING" />
        <Stat label="Failed sign-ins (24h)" value={signIns.failed24h} sub={signIns.lockedAccounts ? `${signIns.lockedAccounts} account(s) temporarily locked` : "No lockouts"} tone={signIns.lockedAccounts ? "danger" : "default"} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Accounts">
          <ul className="space-y-2 text-sm">
            {([
              ["Active", accounts.users.active, "ACTIVE"],
              ["Pending (invited)", accounts.users.pending, "PENDING"],
              ["Suspended", accounts.users.suspended, "SUSPENDED"],
              ["Archived (deactivated)", accounts.users.archived, "ARCHIVED"],
            ] as const).map(([label, n, s]) => (
              <li key={s} className="flex justify-between"><Link href={`/admin/users?status=${s}`} className="hover:underline">{label}</Link><span className="font-mono tabular-nums">{n}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Businesses: {accounts.businesses.active} active · {accounts.businesses.pending} pending · {accounts.businesses.suspended} suspended · {accounts.businesses.archived} archived</p>
        </Card>

        <Card title="Subscriptions & payments">
          {billing ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Active subscriptions</span><span className="font-mono">{billing.activeSubscriptions}</span></li>
              <li className="flex justify-between"><span>Past due</span><span className="font-mono">{billing.pastDueSubscriptions}</span></li>
              <li className="flex justify-between"><span>Outstanding</span><span className="font-mono">{formatMoney(billing.outstandingCents)}</span></li>
              <li className="flex justify-between"><span>Overdue invoices</span><span className="font-mono">{billing.overdueInvoices}</span></li>
              <li className="flex justify-between"><span>Failed payments (90 days)</span><span className="font-mono">{billing.failedPayments90d}</span></li>
              <li className="pt-2 text-xs text-muted">All amounts are manually recorded; no payment provider is connected. <Link href="/admin/billing" className="underline">Billing</Link></li>
            </ul>
          ) : (
            <p className="text-sm text-muted">You don&apos;t have billing access.</p>
          )}
        </Card>

        <Card title="Programme & onboarding" description="Real businesses only (demo data excluded).">
          <Progress value={onboarded} max={Math.max(1, onboarding.length)} label={`${onboarded} of ${onboarding.length} onboarded`} />
          <p className="mt-1 text-[11px] text-subtle">Onboarded = data agreement signed, a user linked and an assessment started.</p>
          <ul className="mt-4 space-y-1 text-sm">
            {STAGES.filter((s) => stageCount(s) > 0).map((s) => (
              <li key={s} className="flex justify-between"><span>{OPERATOR_STATUS_LABELS[s]}</span><span className="font-mono">{stageCount(s)}</span></li>
            ))}
            {totalOps === 0 && <li className="text-muted">No businesses yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Security events" padded={false}>
          <Table>
            <tbody>
              {security.length === 0 && <tr><td className="text-sm text-muted">No security events yet.</td></tr>}
              {security.map((e) => (
                <tr key={e.id}><td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(e.createdAt)}</td><td className="text-sm">{e.summary}<p className="text-[11px] text-subtle">{e.action} · by {e.actor?.name ?? "system"}</p></td></tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Recent activity" padded={false} actions={can(me, "audit.view") ? <Link href="/governance/audit" className="text-xs text-accent hover:underline">Full audit log</Link> : undefined}>
          <Table>
            <tbody>
              {recent.length === 0 && <tr><td className="text-sm text-muted">No activity yet.</td></tr>}
              {recent.map((e) => (
                <tr key={e.id}><td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(e.createdAt)}</td><td className="text-sm">{e.summary}<p className="text-[11px] text-subtle">{e.entityType} · by {e.actor?.name ?? "system"}</p></td></tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
