import { AppShell } from "@/components/AppShell";
import { staffNav } from "@/lib/nav";
import { requireStaff } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { LegacyAppShell } from "@/components/LegacyAppShell";
import { getBrand, newLayoutEnabled } from "@/lib/brand";

// Staff application. Operators are redirected to /portal by requireStaff();
// every page, action and route handler below checks its own permission too.
export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();

  if (!newLayoutEnabled()) {
    // Rotorua pilot: the pre-Phase-1 frame and navigation, unchanged.
    return (
      <LegacyAppShell nav={staffNav(user.permissions, false)} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} logoutAction={logout} productLabel="Tourism AI Growth OS">
        {children}
      </LegacyAppShell>
    );
  }

  const brand = getBrand();
  // Findable shows "Back office" as a pill above the nav (wireframe A1), so
  // the group heading would repeat it.
  const nav = staffNav(user.permissions, true).map((g) => (brand.id === "findable" && g.label === "Back office" ? { ...g, label: undefined } : g));

  return (
    <AppShell
      nav={nav}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
      logoutAction={logout}
      brandName={brand.name}
      productLabel={brand.product}
      variant="backoffice"
      sectionLabel={brand.id === "findable" ? "Back office" : undefined}
    >
      {children}
    </AppShell>
  );
}
