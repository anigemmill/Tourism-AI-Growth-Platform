import { AppShell } from "@/components/AppShell";
import { requireOperator } from "@/lib/auth/portal";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { LegacyAppShell } from "@/components/LegacyAppShell";
import { getBrand, newLayoutEnabled } from "@/lib/brand";

// Operator portal. Every page below re-checks access itself (requireOperator
// / requireOperatorFeature); this layout only builds the frame.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, features } = await requireOperator();
  if (!newLayoutEnabled()) return <LegacyPortalLayout user={user} features={features}>{children}</LegacyPortalLayout>;
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
            { href: "/portal", label: "Overview", icon: "overview" },
            ...(dashboard ? [{ href: "/portal/plan", label: "Action plan", icon: "plan" as const }, { href: "/portal/reports", label: "Reports", icon: "reports" as const }] : []),
            ...(features.includes("portal.collective") ? [{ href: "/portal/collective", label: "Growth Collective", icon: "collective" as const }] : []),
            { href: "/portal/account", label: "Account & team", icon: "account" },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

// Rotorua pilot (NEW_LAYOUT off): the pre-Phase-1 portal frame, unchanged.
async function LegacyPortalLayout({ user, features, children }: Awaited<ReturnType<typeof requireOperator>> & { children: React.ReactNode }) {
  const op = await prisma.operator.findUnique({ where: { id: user.operatorId }, select: { name: true } });
  return (
    <LegacyAppShell
      productLabel="Growth Pilot Portal"
      user={{ name: user.name, roleLabel: "Tourism Operator", context: op?.name }}
      logoutAction={logout}
      nav={[
        {
          items: [
            { href: "/portal", label: "My business" },
            ...(features.includes("portal.collective") ? [{ href: "/portal/collective", label: "Growth Collective" }] : []),
          ],
        },
        { items: [{ href: "/portal/account", label: "My account" }] },
      ]}
    >
      {children}
    </LegacyAppShell>
  );
}
