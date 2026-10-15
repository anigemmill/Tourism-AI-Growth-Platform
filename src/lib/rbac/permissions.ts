// Role-based access control: the permission catalogue, the least-privilege
// defaults for each role, and how overrides combine. Pure functions only, so
// the rules are unit-testable and shared by pages, actions and route handlers.
//
// Effective permissions for a user =
//   FOUNDER (Super Admin): every permission, always. Not configurable, so a
//     super admin can never lock themselves (or the platform) out.
//   anyone else: role defaults below
//     → overridden by RolePermission rows (super admin's role matrix)
//     → overridden by UserPermission rows (per-user grant/deny)
//     → restricted to the permissions valid for the role's scope: staff
//       permissions can never be granted to a Tourism Operator, because staff
//       permissions bypass per-business data scoping (src/lib/authz.ts).

import type { UserRole } from "@/generated/prisma";

export type PermissionScope = "staff" | "tenant";

interface PermissionDef {
  label: string;
  group: string;
  scope: PermissionScope;
  /** High-impact permissions are highlighted and changes need confirmation. */
  sensitive?: boolean;
}

export const PERMISSIONS = {
  // Dashboards
  "dashboard.programme": { label: "Programme dashboard", group: "Dashboards", scope: "staff" },
  "admin.dashboard": { label: "Super Admin dashboard", group: "Dashboards", scope: "staff", sensitive: true },

  // Programme delivery modules (view = read pages; edit = create/change records)
  "operators.view": { label: "View operators & cohort", group: "Operators", scope: "staff" },
  "operators.edit": { label: "Edit operators", group: "Operators", scope: "staff" },
  "assessments.view": { label: "View AI assessments", group: "Operators", scope: "staff" },
  "assessments.edit": { label: "Edit AI assessments", group: "Operators", scope: "staff" },
  "opportunities.view": { label: "View opportunity register", group: "Operators", scope: "staff" },
  "opportunities.edit": { label: "Edit opportunities", group: "Operators", scope: "staff" },
  "work.view": { label: "View projects & tasks", group: "Operators", scope: "staff" },
  "work.edit": { label: "Edit projects & tasks", group: "Operators", scope: "staff" },
  "programme.view": { label: "View 12-week programme", group: "Programme", scope: "staff" },
  "programme.edit": { label: "Edit programme", group: "Programme", scope: "staff" },
  "collective.view": { label: "View Growth Collective", group: "Programme", scope: "staff" },
  "collective.edit": { label: "Edit Growth Collective", group: "Programme", scope: "staff" },
  "experiments.view": { label: "View experiments", group: "Programme", scope: "staff" },
  "experiments.edit": { label: "Edit experiments", group: "Programme", scope: "staff" },
  "results.view": { label: "View baselines & results", group: "Programme", scope: "staff" },
  "results.edit": { label: "Edit baselines & results", group: "Programme", scope: "staff" },
  "reports.view": { label: "View reports", group: "Intelligence", scope: "staff" },
  "library.view": { label: "View agent & workflow library", group: "Intelligence", scope: "staff" },
  "library.edit": { label: "Edit agent & workflow library", group: "Intelligence", scope: "staff" },
  "destination.view": { label: "View destination data", group: "Intelligence", scope: "staff" },
  "destination.manage": { label: "Import data & run connectors", group: "Intelligence", scope: "staff" },
  "governance.view": { label: "View risks & decisions", group: "Governance", scope: "staff" },
  "governance.edit": { label: "Edit risks & decisions", group: "Governance", scope: "staff" },
  "audit.view": { label: "View audit log", group: "Governance", scope: "staff", sensitive: true },
  "data.export": { label: "Export data", group: "Governance", scope: "staff", sensitive: true },
  "commercial.view": { label: "View commercial", group: "Business", scope: "staff", sensitive: true },
  "commercial.edit": { label: "Edit commercial", group: "Business", scope: "staff", sensitive: true },

  // Administration
  "users.view": { label: "View users", group: "Administration", scope: "staff", sensitive: true },
  "users.manage": { label: "Invite, suspend & reset users", group: "Administration", scope: "staff", sensitive: true },
  "users.roles": { label: "Assign roles & user permissions", group: "Administration", scope: "staff", sensitive: true },
  "businesses.view": { label: "View business directory", group: "Administration", scope: "staff" },
  "businesses.manage": { label: "Manage business accounts & features", group: "Administration", scope: "staff", sensitive: true },
  "billing.view": { label: "View billing", group: "Administration", scope: "staff", sensitive: true },
  "billing.manage": { label: "Record billing & adjustments", group: "Administration", scope: "staff", sensitive: true },

  // Tourism operator portal (always limited to the operator's own business)
  "portal.access": { label: "Operator portal", group: "Operator portal", scope: "tenant" },
  "portal.signals": { label: "Submit business updates", group: "Operator portal", scope: "tenant" },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions only a super admin may ever hold; not configurable. */
export const SUPER_ADMIN_ONLY: readonly Permission[] = ["users.roles"];

export const ROLE_SCOPE: Record<UserRole, PermissionScope> = {
  FOUNDER: "staff",
  ADMIN: "staff",
  PROGRAMME_MANAGER: "staff",
  ANALYST: "staff",
  OPERATOR: "tenant",
};

const DELIVERY_VIEW: Permission[] = [
  "dashboard.programme", "operators.view", "assessments.view", "opportunities.view", "work.view",
  "programme.view", "collective.view", "experiments.view", "results.view", "reports.view",
  "library.view", "destination.view", "governance.view",
];
const DELIVERY_EDIT: Permission[] = [
  "operators.edit", "assessments.edit", "opportunities.edit", "work.edit", "programme.edit",
  "collective.edit", "experiments.edit", "results.edit", "library.edit", "governance.edit",
];

/** Least-privilege defaults. FOUNDER is listed for completeness only. */
export const ROLE_DEFAULTS: Record<UserRole, readonly Permission[]> = {
  FOUNDER: ALL_PERMISSIONS,
  // Same access the previous "Programme admin" role had: all delivery data,
  // audit log and exports — no commercial, user management or billing.
  ADMIN: [...DELIVERY_VIEW, ...DELIVERY_EDIT, "destination.manage", "audit.view", "data.export", "businesses.view"],
  PROGRAMME_MANAGER: [...DELIVERY_VIEW, ...DELIVERY_EDIT, "businesses.view"],
  ANALYST: [...DELIVERY_VIEW],
  OPERATOR: ["portal.access", "portal.signals"],
};

export interface Override {
  permission: string;
  granted: boolean;
}

export function isPermission(p: string): p is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, p);
}

/** Can this permission ever be held by this role (via any override)? */
export function assignable(role: UserRole, p: Permission): boolean {
  if (role === "FOUNDER") return true;
  if (SUPER_ADMIN_ONLY.includes(p)) return false;
  return PERMISSIONS[p].scope === ROLE_SCOPE[role];
}

export function effectivePermissions(
  role: UserRole,
  roleOverrides: readonly Override[] = [],
  userOverrides: readonly Override[] = []
): Permission[] {
  if (role === "FOUNDER") return [...ALL_PERMISSIONS];
  const set = new Set<Permission>(ROLE_DEFAULTS[role]);
  for (const layer of [roleOverrides, userOverrides]) {
    for (const o of layer) {
      if (!isPermission(o.permission)) continue;
      if (o.granted) set.add(o.permission);
      else set.delete(o.permission);
    }
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p) && assignable(role, p));
}

export function hasPermission(user: { permissions: readonly string[] }, p: Permission): boolean {
  return user.permissions.includes(p);
}

/** Holds any staff-scope permission, i.e. may use the staff application. */
export function isStaffUser(user: { role: UserRole; permissions: readonly string[] }): boolean {
  return ROLE_SCOPE[user.role] === "staff" && user.permissions.some((p) => isPermission(p) && PERMISSIONS[p].scope === "staff");
}

/** Roles a given actor may assign. Only super admins can create super admins. */
export function assignableRoles(actorRole: UserRole): UserRole[] {
  const all: UserRole[] = ["FOUNDER", "ADMIN", "PROGRAMME_MANAGER", "ANALYST", "OPERATOR"];
  return actorRole === "FOUNDER" ? all : all.filter((r) => r !== "FOUNDER");
}
