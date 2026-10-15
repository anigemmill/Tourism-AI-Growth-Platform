// Staff navigation, built from the signed-in user's permissions so nobody is
// shown a section they can't open (the pages enforce it regardless).

import type { NavGroup } from "@/components/AppShell";
import type { Permission } from "@/lib/rbac/permissions";

type Item = { href: string; label: string; badge?: string; permission: Permission };

const GROUPS: { label?: string; items: Item[] }[] = [
  { items: [{ href: "/", label: "Dashboard", permission: "dashboard.programme" }] },
  {
    label: "Operators",
    items: [
      { href: "/operators", label: "Cohort & operators", permission: "operators.view" },
      { href: "/assessments", label: "AI assessments", permission: "assessments.view" },
      { href: "/opportunities", label: "Opportunity register", permission: "opportunities.view" },
      { href: "/work", label: "Projects & tasks", permission: "work.view" },
    ],
  },
  {
    label: "Programme",
    items: [
      { href: "/programme", label: "12-week programme", permission: "programme.view" },
      { href: "/collective", label: "Growth Collective", permission: "collective.view" },
      { href: "/experiments", label: "Experiments", permission: "experiments.view" },
      { href: "/results", label: "Baselines & results", permission: "results.view" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/reports", label: "Reports", permission: "reports.view" },
      { href: "/library", label: "Agent & workflow library", permission: "library.view" },
      { href: "/destination", label: "Destination data", badge: "Next", permission: "destination.view" },
    ],
  },
  { label: "Business", items: [{ href: "/commercial", label: "Commercial", permission: "commercial.view" }] },
  {
    label: "Governance",
    items: [
      { href: "/governance", label: "Risks & decisions", permission: "governance.view" },
      { href: "/governance/audit", label: "Audit log", permission: "audit.view" },
      { href: "/export", label: "Data export", permission: "data.export" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin", label: "Admin overview", permission: "admin.dashboard" },
      { href: "/admin/users", label: "Users", permission: "users.view" },
      { href: "/admin/businesses", label: "Businesses", permission: "businesses.view" },
      { href: "/admin/billing", label: "Billing", permission: "billing.view" },
      { href: "/admin/access", label: "Roles & permissions", permission: "users.roles" },
    ],
  },
];

export function staffNav(permissions: readonly string[]): NavGroup[] {
  const groups = GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => permissions.includes(i.permission)).map(({ href, label, badge }) => ({ href, label, badge })),
  })).filter((g) => g.items.length > 0);
  return [...groups, { items: [{ href: "/account", label: "My account" }] }];
}

/** Where a staff user lands when "/" isn't available to them. */
export function staffHome(permissions: readonly string[]): string {
  return staffNav(permissions)[0]?.items[0]?.href ?? "/account";
}
