// Staff navigation, built from the signed-in user's permissions so nobody is
// shown a section they can't open (the pages enforce it regardless).

import type { NavGroup } from "@/components/AppShell";
import type { Permission } from "@/lib/rbac/permissions";
import { getBrand, newLayoutEnabled, type BrandId } from "@/lib/brand";

type Item = { href: string; label: string; badge?: string; permission: Permission };

type Group = { label?: string; items: Item[] };

// Phase 1 (Findable) back office first; the pilot's tools follow.
const BACK_OFFICE: Group = {
  label: "Back office",
  items: [
    { href: "/admin", label: "Overview", permission: "admin.dashboard" },
    { href: "/admin/businesses", label: "Clients", permission: "businesses.view" },
    { href: "/admin/billing", label: "Billing", permission: "billing.view" },
    { href: "/admin/users", label: "Users & access", permission: "users.view" },
    { href: "/admin/access", label: "Roles & permissions", permission: "users.roles" },
  ],
};

// The pre-Phase-1 navigation, unchanged for the Rotorua pilot (NEW_LAYOUT off).
const LEGACY_ADMINISTRATION: Group = {
  label: "Administration",
  items: [
    { href: "/admin", label: "Admin overview", permission: "admin.dashboard" },
    { href: "/admin/users", label: "Users", permission: "users.view" },
    { href: "/admin/businesses", label: "Businesses", permission: "businesses.view" },
    { href: "/admin/billing", label: "Billing", permission: "billing.view" },
    { href: "/admin/access", label: "Roles & permissions", permission: "users.roles" },
  ],
};

const PILOT_GROUPS: Group[] = [
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
];

const NEW_GROUPS: Group[] = [BACK_OFFICE, { label: "Rotorua pilot", items: [{ href: "/", label: "Programme dashboard", permission: "dashboard.programme" }] }, ...PILOT_GROUPS];
const LEGACY_GROUPS: Group[] = [{ items: [{ href: "/", label: "Dashboard", permission: "dashboard.programme" }] }, ...PILOT_GROUPS, LEGACY_ADMINISTRATION];

// Findable is not the Rotorua pilot: neutral label, and the Rotorua
// destination-data module is left out of its navigation (the pages and their
// permission checks are unchanged).
const FINDABLE_HIDDEN = new Set(["/destination"]);
function forBrand(groups: Group[], brand: BrandId): Group[] {
  if (brand !== "findable") return groups;
  return groups.map((g) => ({
    label: g.label === "Rotorua pilot" ? "Programme" : g.label,
    items: g.items.filter((i) => !FINDABLE_HIDDEN.has(i.href)),
  }));
}

export function staffNav(permissions: readonly string[], newLayout = newLayoutEnabled(), brand: BrandId = getBrand().id): NavGroup[] {
  const groups = forBrand(newLayout ? NEW_GROUPS : LEGACY_GROUPS, brand).map((g) => ({
    label: g.label,
    items: g.items.filter((i) => permissions.includes(i.permission)).map(({ href, label, badge }) => ({ href, label, badge })),
  })).filter((g) => g.items.length > 0);
  return [...groups, { items: [{ href: "/account", label: "My account" }] }];
}

/** Where a staff user lands when "/" isn't available to them. */
export function staffHome(permissions: readonly string[]): string {
  return staffNav(permissions)[0]?.items[0]?.href ?? "/account";
}
