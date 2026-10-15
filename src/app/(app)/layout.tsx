import { AppShell } from "@/components/AppShell";
import { staffNav } from "@/lib/nav";
import { requireStaff } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/labels";

// Staff application. Operators are redirected to /portal by requireStaff();
// every page, action and route handler below checks its own permission too.
export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();

  const nav = staffNav(user.permissions);

  return (
    <AppShell nav={nav} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} logoutAction={logout} productLabel="Tourism AI Growth OS">
      {children}
    </AppShell>
  );
}
