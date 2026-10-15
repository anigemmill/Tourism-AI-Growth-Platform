import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { Card, OperatorStatusBadge, PageHeader, Table } from "@/components/ui";
import { FilterBar, Pager } from "@/components/admin/ListControls";
import { AccountStatusBadge, fmtDate, SubscriptionBadge } from "@/components/admin/badges";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { oneOf, pageOf, param } from "@/lib/admin/paging";
import { ACCOUNT_STATUS_LABELS, OPERATOR_STATUS_LABELS, options } from "@/lib/labels";

const ACCOUNT = ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const PROGRAMME_STATUS = ["PROSPECT", "INVITED", "ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"] as const;

export default async function AdminBusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  const me = await requirePermission("businesses.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const account = oneOf(param(sp, "account"), ACCOUNT);
  const stage = oneOf(param(sp, "stage"), PROGRAMME_STATUS);
  const programmeId = param(sp, "programme") || undefined;
  const { page, skip, take } = pageOf(sp);
  const where: Prisma.OperatorWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { contactEmail: { contains: q, mode: "insensitive" } }, { cohort: { contains: q, mode: "insensitive" } }] } : {}),
    ...(account ? { accountStatus: account } : {}),
    ...(stage ? { status: stage } : {}),
    ...(programmeId ? { programmeId } : {}),
  };
  const showBilling = can(me, "billing.view");
  const [rows, total, programmes] = await Promise.all([
    prisma.operator.findMany({
      where, skip, take, orderBy: { name: "asc" },
      select: {
        id: true, name: true, category: true, status: true, accountStatus: true, cohort: true, contactName: true, contactEmail: true, createdAt: true, isSynthetic: true,
        programme: { select: { name: true } },
        _count: { select: { members: true } },
        subscriptions: showBilling ? { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, plan: true } } : false,
      },
    }),
    prisma.operator.count({ where }),
    prisma.programme.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Businesses" description="Every tourism business on the platform: account status, programme, users and subscription. Add new businesses from Cohort & operators." />
      <FilterBar
        action="/admin/businesses"
        q={q}
        placeholder="Business, contact or cohort"
        filters={[
          { name: "account", label: "Account", value: account ?? "", options: options(ACCOUNT_STATUS_LABELS) },
          { name: "stage", label: "Programme stage", value: stage ?? "", options: options(OPERATOR_STATUS_LABELS) },
          { name: "programme", label: "Programme", value: programmeId ?? "", options: programmes.map((p) => ({ value: p.id, label: p.name })) },
        ]}
      />
      <Card padded={false}>
        <Table>
          <thead><tr><th>Business</th><th>Account</th><th>Programme</th><th>Users</th>{showBilling && <th>Subscription</th>}<th>Added</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/admin/businesses/${b.id}`} className="font-medium hover:underline">{b.name}</Link>{b.isSynthetic && <span className="ml-1 text-[10px] uppercase text-subtle">demo</span>}<p className="text-xs text-muted">{b.contactName ?? "—"}{b.contactEmail ? ` · ${b.contactEmail}` : ""}</p></td>
                <td><AccountStatusBadge s={b.accountStatus} /></td>
                <td className="text-xs"><OperatorStatusBadge s={b.status} /><p className="mt-1 text-muted">{b.programme?.name ?? "No programme"}{b.cohort ? ` · ${b.cohort}` : ""}</p></td>
                <td className="text-sm tabular-nums">{b._count.members}</td>
                {showBilling && <td className="text-xs">{b.subscriptions?.[0] ? <><SubscriptionBadge s={b.subscriptions[0].status} /><p className="mt-1 text-muted">{b.subscriptions[0].plan}</p></> : <span className="text-muted">None</span>}</td>}
                <td className="whitespace-nowrap text-xs text-muted">{fmtDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager base="/admin/businesses" sp={sp} page={page} total={total} />
      </Card>
    </div>
  );
}
