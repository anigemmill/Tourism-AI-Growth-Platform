import { ActionForm, Badge, Card, ConfirmBox, Notice, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, assignable, effectivePermissions, PERMISSIONS, ROLE_DEFAULTS, type Permission } from "@/lib/rbac/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/generated/prisma";
import { saveRolePermissions } from "./actions";

const CONFIGURABLE: UserRole[] = ["ADMIN", "PROGRAMME_MANAGER", "ANALYST", "OPERATOR"];

export default async function AccessPage() {
  await requirePermission("users.roles");
  const [overrides, counts] = await Promise.all([
    prisma.rolePermission.findMany(),
    prisma.user.groupBy({ by: ["role"], where: { status: { in: ["ACTIVE", "PENDING"] } }, _count: true }),
  ]);
  const countFor = (r: UserRole) => counts.find((c) => c.role === r)?._count ?? 0;
  const groups = [...new Set(ALL_PERMISSIONS.map((p) => PERMISSIONS[p].group))];

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Roles & permissions" description="Choose what each role can see and do, per dashboard, module and action. Every page, action and API route checks these on the server." />
      <div className="mb-6 space-y-3">
        <Notice tone="info">
          <strong>Super Admin</strong> always holds every permission and can&apos;t be restricted, so the platform can never be locked out. Tourism Operators can only ever hold operator-portal permissions, which are limited to their own business. Individual users can be given exceptions on their user page.
        </Notice>
      </div>
      <div className="space-y-6">
        {CONFIGURABLE.map((role) => {
          const effective = new Set(effectivePermissions(role, overrides.filter((o) => o.role === role)));
          const defaults = new Set<Permission>(ROLE_DEFAULTS[role]);
          return (
            <Card key={role} title={`${ROLE_LABELS[role]} · ${countFor(role)} user(s)`} description={ROLE_DESCRIPTIONS[role]}>
              <ActionForm action={saveRolePermissions.bind(null, role)} submitLabel={`Save ${ROLE_LABELS[role]} permissions`}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((g) => {
                    const perms = ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].group === g && assignable(role, p));
                    if (perms.length === 0) return null;
                    return (
                      <fieldset key={g}>
                        <legend className="eyebrow mb-2 text-subtle">{g}</legend>
                        <ul className="space-y-1.5">
                          {perms.map((p) => (
                            <li key={p}>
                              <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" name="permissions" value={p} defaultChecked={effective.has(p)} className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[var(--brand)]" />
                                <span>
                                  {PERMISSIONS[p].label}
                                  {"sensitive" in PERMISSIONS[p] && <Badge tone="warning">sensitive</Badge>}
                                  {effective.has(p) !== defaults.has(p) && <span className="ml-1 text-[11px] text-info">changed from default</span>}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    );
                  })}
                </div>
                <ConfirmBox>Apply these permissions to every {ROLE_LABELS[role]} account.</ConfirmBox>
              </ActionForm>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
