import { AppShell } from "@/components/AppShell";
import { requireOperator } from "@/lib/auth/portal";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";

// Operator portal. Every page below re-checks access itself (requireOperator
// / requireOperatorFeature); this layout only builds the frame.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, features } = await requireOperator();
  const brand = getBrand();
  const op = await prisma.operator.findUnique({
    where: { id: user.operatorId },
    select: { name: true, category: true, cohort: true },
  });
  const dashboard = features.includes("portal.dashboard");
  const category = op?.category ? op.category.charAt(0).toUpperCase() + op.category.slice(1).replace(/-/g, " & ") : undefined;
  return (
    <AppShell
      brandName={brand.name}
      productLabel={brand.id === "findable" ? brand.name : "Growth Pilot Portal"}
      variant="client"
      business={op ? { name: op.name, detail: [op.cohort, category].filter(Boolean).join(" · ") || undefined } : undefined}
      user={{ name: user.name, roleLabel: "Tourism Operator" }}
      logoutAction={logout}
      nav={[
        {
          items: [
            { href: "/portal", label: "Overview" },
            ...(dashboard ? [{ href: "/portal/plan", label: "Action plan" }, { href: "/portal/reports", label: "Reports" }] : []),
            ...(features.includes("portal.collective") ? [{ href: "/portal/collective", label: "Growth Collective" }] : []),
            { href: "/portal/account", label: "Account & team" },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
