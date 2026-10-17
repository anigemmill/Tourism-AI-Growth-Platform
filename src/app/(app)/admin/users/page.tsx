import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { ActionForm, Card, ConfirmBox, FormGrid, Notice, PageHeader, Select, Table, TextField } from "@/components/ui";
import { FilterBar, Pager } from "@/components/admin/ListControls";
import { fmtDate, fmtDateTime, RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { emailStatus } from "@/lib/admin/email-check";
import { oneOf, pageOf, param } from "@/lib/admin/paging";
import { assignableRoles } from "@/lib/rbac/permissions";
import { ROLE_LABELS, USER_STATUS_LABELS, options } from "@/lib/labels";
import { emailCheck, inviteUser } from "./actions";

const ROLES = ["FOUNDER", "ADMIN", "PROGRAMME_MANAGER", "ANALYST", "OPERATOR"] as const;
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requirePermission("users.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const role = oneOf(param(sp, "role"), ROLES);
  const status = oneOf(param(sp, "status"), STATUSES);
  const businessId = param(sp, "business") || undefined;
  const { page, skip, take } = pageOf(sp);

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(businessId ? { businesses: { some: { operatorId: businessId } } } : {}),
  };
  const [users, total, businesses] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, orderBy: [{ createdAt: "desc" }],
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true, businesses: { select: { operator: { select: { name: true } } } } },
    }),
    prisma.user.count({ where }),
    prisma.operator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const canManage = can(me, "users.manage");
  const email = emailStatus();
  const roleOpts = (canManage && can(me, "users.roles") ? assignableRoles(me.role) : ["OPERATOR", "ANALYST"]).map((r) => ({ value: r, label: ROLE_LABELS[r as keyof typeof ROLE_LABELS] }));

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Users" description="Everyone with an account. Passwords are never shown or stored in readable form — users set their own through single-use emailed links." />
      <FilterBar
        action="/admin/users"
        q={q}
        placeholder="Name or email"
        filters={[
          { name: "role", label: "Role", value: role ?? "", options: options(ROLE_LABELS) },
          { name: "status", label: "Status", value: status ?? "", options: options(USER_STATUS_LABELS) },
          { name: "business", label: "Business", value: businessId ?? "", options: businesses.map((b) => ({ value: b.id, label: b.name })) },
        ]}
      />
      <Card padded={false} className="mb-6">
        <Table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Businesses</th><th>Last sign-in</th><th>Created</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name}</Link><p className="text-xs text-muted">{u.email}</p></td>
                <td><RoleBadge r={u.role} /></td>
                <td><UserStatusBadge s={u.status} /></td>
                <td className="text-xs text-muted">{u.businesses.map((b) => b.operator.name).join(", ") || "—"}</td>
                <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(u.lastLoginAt)}</td>
                <td className="whitespace-nowrap text-xs text-muted">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager base="/admin/users" sp={sp} page={page} total={total} />
      </Card>

      {me.role === "FOUNDER" && (
        <Card title="Account email" description="How invitations and password resets are sent. The test goes only to your own address and contains no link." className="mb-6">
          <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Provider</dt><dd>{email.configured ? "Resend (key and sender set)" : "Not configured"}</dd>
            <dt className="text-muted">Sender</dt><dd className="break-all">{email.sender ?? "—"}</dd>
            <dt className="text-muted">Links point to</dt><dd className="break-all">{email.linkProblem ? "— (blocked, see below)" : email.linkBase}</dd>
          </dl>
          {email.linkProblem && <div className="mb-4"><Notice tone="warning">{email.linkProblem} Until then no invitation or reset link is issued.</Notice></div>}
          {email.configured && <ActionForm action={emailCheck} submitLabel={`Send a test email to ${me.email}`} variant="secondary" />}
        </Card>
      )}

      {canManage && (
        <Card title="Invite a user" description="They receive a single-use link (valid 7 days) to set their own password. Tourism operators must be linked to at least one business.">
          {email.linkProblem && <div className="mb-4"><Notice tone="warning">Invitation links are blocked: {email.linkProblem}</Notice></div>}
          {!email.configured && (
            <div className="mb-4"><Notice tone="warning">Email isn&apos;t configured (RESEND_API_KEY / EMAIL_FROM), so invitations can&apos;t be emailed. A super admin will be shown a single-use link to hand over instead.</Notice></div>
          )}
          <ActionForm action={inviteUser} submitLabel="Send invitation" resetOnSuccess>
            <FormGrid>
              <TextField name="name" label="Name" required />
              <TextField name="email" label="Email" type="email" required autoComplete="off" />
              <Select name="role" label="Role" options={roleOpts} defaultValue="OPERATOR" />
              <div>
                <label htmlFor="f-businessIds" className="mb-1 block text-xs font-medium text-muted">Businesses</label>
                <select id="f-businessIds" name="businessIds" multiple size={Math.min(6, Math.max(3, businesses.length))} className="block w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm">
                  {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-subtle">Hold Ctrl / ⌘ to choose several.</p>
              </div>
            </FormGrid>
            {me.role === "FOUNDER" && <ConfirmBox required={false}>If inviting a Super Admin: I understand they will have full access, including users, billing and permissions.</ConfirmBox>}
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
