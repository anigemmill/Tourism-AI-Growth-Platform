import { AppShell } from "@/components/AppShell";
import { logout } from "@/app/actions/auth";
import { getBrand } from "@/lib/brand";
import { requireClientView } from "@/lib/support/session";

// Super Admin client view: the client's portal frame for one business.
// Every page and action below re-checks access itself; this only builds
// the frame. Not linked from the operator portal; only Super Admins get in.
export default async function SupportLayout({ children, params }: LayoutProps<"/support/[operatorId]">) {
  const { operatorId } = await params;
  const { admin, business, features } = await requireClientView(operatorId);
  const brand = getBrand();
  const base = `/support/${business.id}`;
  const dashboard = features.includes("portal.dashboard");
  const category = business.category ? business.category.charAt(0).toUpperCase() + business.category.slice(1).replace(/-/g, " & ") : undefined;
  return (
    <AppShell
      brandName={brand.name}
      productLabel={brand.id === "findable" ? brand.name : "Growth Pilot Portal"}
      variant="client"
      sectionLabel="Client view"
      business={{ name: business.name, detail: [business.cohort, category].filter(Boolean).join(" · ") || undefined }}
      user={{ name: admin.name, roleLabel: "Super Admin" }}
      logoutAction={logout}
      nav={[
        {
          items: [
            { href: base, label: "Overview", icon: "overview" },
            ...(dashboard ? [{ href: `${base}/plan`, label: "Action plan", icon: "plan" as const }, { href: `${base}/reports`, label: "Reports", icon: "reports" as const }] : []),
            { href: `${base}/account`, label: "Account & team", icon: "account" },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
