import { AppShell } from "@/components/AppShell";
import { requireOperator } from "@/lib/auth/portal";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, features } = await requireOperator();
  const op = await prisma.operator.findUnique({ where: { id: user.operatorId }, select: { name: true } });
  return (
    <AppShell
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
    </AppShell>
  );
}
