import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { staffNav } from "@/lib/nav";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "No access" };

// Outside the staff layout on purpose: a staff user without any staff
// permission must not be redirected back into it.
export default async function NoAccessPage() {
  const user = await requireUser();
  const links = user.role === "OPERATOR" ? [{ href: "/portal", label: "Go to your portal" }] : staffNav(user.permissions).flatMap((g) => g.items).slice(0, 6);
  return (
    <AuthShell>
      <AuthHeading title="You don't have access to that">Your role doesn&apos;t include that page or action. If you need it, ask a super admin.</AuthHeading>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">{l.label}</Link></li>
        ))}
      </ul>
    </AuthShell>
  );
}
