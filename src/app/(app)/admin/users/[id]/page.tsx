import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Badge, Card, ConfirmBox, DefinitionList, Notice, PageHeader, Select, Table, TextField } from "@/components/ui";
import { fmtDateTime, RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, assignable, assignableRoles, effectivePermissions, PERMISSIONS, ROLE_DEFAULTS } from "@/lib/rbac/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import type { UserStatus } from "@/generated/prisma";

const STATUS_TARGETS: Record<UserStatus, ("ACTIVE" | "SUSPENDED" | "ARCHIVED")[]> = {
  PENDING: [], ACTIVE: ["SUSPENDED", "ARCHIVED"], SUSPENDED: ["ACTIVE", "ARCHIVED"], ARCHIVED: ["ACTIVE"],
};
const STATUS_VERBS = { ACTIVE: "Reactivate", SUSPENDED: "Suspend", ARCHIVED: "Deactivate" } as const;
import * as act from "../actions";

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requirePermission("users.view");
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      businesses: { include: { operator: { select: { id: true, name: true, accountStatus: true } } }, orderBy: { createdAt: "asc" } },
      permissions: true,
      sessions: { where: { expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } },
      authTokens: { where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { purpose: true, expiresAt: true } },
    },
  });
  if (!u) notFound();

  const [roleOverrides, activity, logins, businesses] = await Promise.all([
    prisma.rolePermission.findMany({ where: { role: u.role } }),
    prisma.auditLog.findMany({
      where: { OR: [{ entityType: "user", entityId: u.id }, { actorId: u.id }] },
      orderBy: { createdAt: "desc" }, take: 40, include: { actor: { select: { name: true } } },
    }),
    prisma.loginAttempt.findMany({ where: { email: u.email }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.operator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const self = u.id === me.id;
  // Non-super-admins can view, but not change, super admin accounts.
  const targetLocked = u.role === "FOUNDER" && me.role !== "FOUNDER";
  const canManage = can(me, "users.manage") && !targetLocked;
  const canRoles = can(me, "users.roles") && !targetLocked;
  const effective = new Set(effectivePermissions(u.role, roleOverrides, u.permissions));
  const roleEffective = new Set(effectivePermissions(u.role, roleOverrides));
  const userOverride = new Map(u.permissions.map((p) => [p.permission, p.granted]));
  const linked = new Set(u.businesses.map((b) => b.operatorId));
  const pendingInvite = u.authTokens.find((t) => t.purpose === "INVITE");

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/admin/users" className="hover:underline">Users</Link>}
        title={u.name}
        description={u.email}
        actions={<div className="flex gap-2"><RoleBadge r={u.role} /><UserStatusBadge s={u.status} /></div>}
      />
      {self && <div className="mb-6"><Notice tone="info">This is your own account. You can&apos;t change your own role or status; manage your password and sessions from <Link href="/account" className="underline">My account</Link>.</Notice></div>}
      {targetLocked && <div className="mb-6"><Notice tone="info">Only a super admin can change a super admin account.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Account">
            <DefinitionList
              items={[
                { label: "Role", value: <>{ROLE_LABELS[u.role]}<p className="text-xs text-muted">{ROLE_DESCRIPTIONS[u.role]}</p></> },
                { label: "Created", value: fmtDateTime(u.createdAt) },
                { label: "Last sign-in", value: fmtDateTime(u.lastLoginAt) },
                { label: "Email", value: u.emailVerifiedAt ? `Confirmed ${fmtDateTime(u.emailVerifiedAt)}` : "Not confirmed" },
                { label: "Password", value: u.passwordHash ? `Set${u.passwordChangedAt ? ` · changed ${fmtDateTime(u.passwordChangedAt)}` : ""}` : "Not set yet (invitation pending)" },
                { label: "Active sessions", value: String(u.sessions.length) },
                ...(pendingInvite ? [{ label: "Invitation", value: `Link valid until ${fmtDateTime(pendingInvite.expiresAt)}` }] : []),
              ]}
            />
          </Card>

          <Card title="Businesses" description={u.role === "OPERATOR" ? "A tourism operator sees only these businesses' information. Removing a link takes effect immediately." : "Links for staff are informational (e.g. account manager or primary contact)."} padded={false}>
            <Table>
              <tbody>
                {u.businesses.length === 0 && <tr><td className="text-sm text-muted">Not linked to any business.</td></tr>}
                {u.businesses.map((b) => (
                  <tr key={b.operatorId}>
                    <td><Link href={`/admin/businesses/${b.operatorId}`} className="font-medium hover:underline">{b.operator.name}</Link> {b.isPrimaryContact && <Badge tone="info">Primary contact</Badge>} {b.operator.accountStatus !== "ACTIVE" && <Badge tone="warning">Business {b.operator.accountStatus.toLowerCase()}</Badge>} {u.operatorId === b.operatorId && u.role === "OPERATOR" && <Badge tone="outline">Current</Badge>}</td>
                    <td className="text-right">
                      {canManage && (
                        <ActionForm action={act.unlinkBusiness.bind(null, u.id, b.operatorId)} inline submitLabel="Remove" variant="ghost">
                          <ConfirmBox>Confirm</ConfirmBox>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {canManage && (
              <div className="border-t border-line p-4">
                <ActionForm action={act.linkBusiness.bind(null, u.id)} submitLabel="Link business" inline>
                  <label htmlFor="link-op" className="sr-only">Business</label>
                  <select id="link-op" name="operatorId" required className="rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm">
                    <option value="">Choose a business…</option>
                    {businesses.filter((b) => !linked.has(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" name="isPrimaryContact" /> Primary contact</label>
                </ActionForm>
              </div>
            )}
          </Card>

          {u.role !== "FOUNDER" && (
            <Card title="Permissions" description={`Defaults come from the ${ROLE_LABELS[u.role]} role (configurable under Roles & permissions). Override them for this user only. Changes apply on the user's next request.`} padded={false}>
              <Table>
                <thead><tr><th>Permission</th><th>Role gives</th><th>Effective</th>{canRoles && <th>Override</th>}</tr></thead>
                <tbody>
                  {ALL_PERMISSIONS.filter((p) => assignable(u.role, p)).map((p) => {
                    const o = userOverride.get(p);
                    return (
                      <tr key={p}>
                        <td className="text-sm">{PERMISSIONS[p].label}<p className="text-[11px] text-subtle">{PERMISSIONS[p].group}{ROLE_DEFAULTS[u.role].includes(p) ? "" : " · not in role default"}</p></td>
                        <td className="text-xs text-muted">{roleEffective.has(p) ? "Yes" : "No"}</td>
                        <td>{effective.has(p) ? <Badge tone="success">Allowed</Badge> : <Badge tone="outline">No</Badge>}</td>
                        {canRoles && (
                          <td>
                            <ActionForm action={act.setUserPermission.bind(null, u.id, p)} inline submitLabel="Set" variant="ghost" confirm={"sensitive" in PERMISSIONS[p] ? `Change “${PERMISSIONS[p].label}” for ${u.name}?` : undefined}>
                              <label className="sr-only" htmlFor={`perm-${p}`}>Override for {PERMISSIONS[p].label}</label>
                              <select id={`perm-${p}`} name="value" defaultValue={o === undefined ? "inherit" : o ? "grant" : "deny"} className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-xs">
                                <option value="inherit">Role default</option>
                                <option value="grant">Grant</option>
                                <option value="deny">Deny</option>
                              </select>
                            </ActionForm>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}

          <Card title="Activity history" padded={false}>
            <Table>
              <tbody>
                {activity.length === 0 && <tr><td className="text-sm text-muted">No recorded activity.</td></tr>}
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(a.createdAt)}</td>
                    <td className="text-xs text-muted">{a.action}</td>
                    <td className="text-sm">{a.summary}<p className="text-[11px] text-subtle">by {a.actor?.name ?? "system"}</p></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          {!self && canManage && u.status === "PENDING" && (
            <Card title="Invitation">
              <div className="space-y-4">
                <ActionForm action={act.resendInvite.bind(null, u.id)} submitLabel="Resend invitation" variant="secondary" />
                <ActionForm action={act.revokeInvite.bind(null, u.id)} submitLabel="Revoke invitation" variant="danger">
                  <ConfirmBox>Revoke the invitation. The link stops working.</ConfirmBox>
                </ActionForm>
              </div>
            </Card>
          )}

          {!self && canManage && u.status !== "PENDING" && (
            <Card title="Account status" description="Suspend blocks sign-in temporarily; deactivate retires the account. Both sign the user out everywhere. Records and history are kept.">
              <ActionForm action={act.setStatus.bind(null, u.id)} submitLabel="Change status" variant="danger">
                <Select
                  name="status"
                  label={`Currently ${USER_STATUS_LABELS[u.status].toLowerCase()} — change to`}
                  options={STATUS_TARGETS[u.status].map((s) => ({ value: s, label: STATUS_VERBS[s] }))}
                />
                <ConfirmBox>I&apos;ve checked this is the right account ({u.email}).</ConfirmBox>
              </ActionForm>
            </Card>
          )}

          {!self && canManage && u.status === "ACTIVE" && (
            <Card title="Security">
              <div className="space-y-5">
                <ActionForm action={act.sendReset.bind(null, u.id)} submitLabel="Send password reset link" variant="secondary">
                  <ConfirmBox>Email {u.email} a single-use link (valid 1 hour) to choose a new password.</ConfirmBox>
                </ActionForm>
                <ActionForm action={act.revokeSessions.bind(null, u.id)} submitLabel={`Sign out everywhere (${u.sessions.length})`} variant="danger">
                  <ConfirmBox>End all of {u.name}&apos;s sessions now.</ConfirmBox>
                </ActionForm>
              </div>
            </Card>
          )}

          {!self && canRoles && (
            <Card title="Role" description="Changing role signs the user out and clears their per-user permission overrides.">
              <ActionForm action={act.changeRole.bind(null, u.id)} submitLabel="Change role">
                <Select name="role" label="Role" defaultValue={u.role} options={assignableRoles(me.role).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
                <ConfirmBox>I&apos;ve checked this role is right. Super Admin grants full access, including billing and permissions.</ConfirmBox>
              </ActionForm>
            </Card>
          )}

          {canManage && (
            <Card title="Name">
              <ActionForm action={act.rename.bind(null, u.id)} submitLabel="Save">
                <TextField name="name" label="Display name" defaultValue={u.name} required />
              </ActionForm>
            </Card>
          )}

          <Card title="Recent sign-in attempts" padded={false}>
            <Table>
              <tbody>
                {logins.length === 0 && <tr><td className="text-sm text-muted">None recorded.</td></tr>}
                {logins.map((l) => (
                  <tr key={l.id}><td className="text-xs text-muted">{fmtDateTime(l.createdAt)}</td><td>{l.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failed</Badge>}</td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
