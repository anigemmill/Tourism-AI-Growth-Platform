// "My account": profile, email confirmation, password change, sessions and
// (for operators linked to several businesses) the current business.
// Shared by /account (staff) and /portal/account (operators).

import { ActionForm, Badge, Card, ConfirmBox, DefinitionList, Select, Table, TextField } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { ROLE_LABELS } from "@/lib/labels";
import { changePassword, revokeMySession, revokeOtherSessions, sendVerificationEmail, switchBusiness } from "@/app/actions/account";

const fmt = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Pacific/Auckland" });

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export async function AccountPanel({ user }: { user: AuthUser }) {
  const [me, sessions, memberships] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true, createdAt: true, lastLoginAt: true, passwordChangedAt: true } }),
    prisma.authSession.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    prisma.userBusiness.findMany({ where: { userId: user.id }, include: { operator: { select: { id: true, name: true, accountStatus: true } } } }),
  ]);
  const activeBusinesses = memberships.filter((m) => m.operator.accountStatus === "ACTIVE");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Profile">
        <DefinitionList
          items={[
            { label: "Name", value: user.name },
            { label: "Email", value: <>{user.email} {me.emailVerifiedAt ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}</> },
            { label: "Role", value: ROLE_LABELS[user.role] },
            { label: "Member since", value: fmt.format(me.createdAt) },
            { label: "Password last changed", value: me.passwordChangedAt ? fmt.format(me.passwordChangedAt) : "—" },
            ...(memberships.length ? [{ label: "Businesses", value: memberships.map((m) => m.operator.name).join(", ") }] : []),
          ]}
        />
        {!me.emailVerifiedAt && (
          <div className="mt-4">
            <ActionForm action={sendVerificationEmail} submitLabel="Send confirmation email" variant="secondary" inline />
          </div>
        )}
      </Card>

      <Card title="Change password" description="You'll stay signed in here and be signed out everywhere else.">
        <ActionForm action={changePassword} submitLabel="Change password" resetOnSuccess>
          <TextField name="current" label="Current password" type="password" required autoComplete="current-password" />
          <TextField name="password" label="New password" type="password" required autoComplete="new-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
          <TextField name="confirm" label="Confirm new password" type="password" required autoComplete="new-password" />
        </ActionForm>
      </Card>

      {user.role === "OPERATOR" && activeBusinesses.length > 1 && (
        <Card title="Current business" description="Choose which of your businesses you're working in.">
          <ActionForm action={switchBusiness} submitLabel="Switch business">
            <Select name="operatorId" label="Business" defaultValue={user.operatorId ?? undefined} options={activeBusinesses.map((m) => ({ value: m.operator.id, label: m.operator.name }))} />
          </ActionForm>
        </Card>
      )}

      <Card title="Where you're signed in" padded={false} className="lg:col-span-2">
        <Table>
          <thead><tr><th>Device</th><th>Signed in</th><th>Last active</th><th /></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="text-sm">{device(s.userAgent)} {s.id === user.sessionId && <Badge tone="success">This device</Badge>}</td>
                <td className="text-xs text-muted">{fmt.format(s.createdAt)}</td>
                <td className="text-xs text-muted">{fmt.format(s.lastSeenAt)}</td>
                <td className="text-right">
                  <ActionForm action={revokeMySession.bind(null, s.id)} inline submitLabel="Sign out" variant="ghost" />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {sessions.length > 1 && (
          <div className="border-t border-line p-4">
            <ActionForm action={revokeOtherSessions} submitLabel="Sign out all other sessions" variant="danger" inline>
              <ConfirmBox>Sign out of every other device</ConfirmBox>
            </ActionForm>
          </div>
        )}
      </Card>
    </div>
  );
}
