import Link from "next/link";
import { AuthHeading } from "./AuthShell";

export function InvalidLink({ title, children, action = { href: "/forgot-password", label: "Request a new link" } }: { title: string; children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <>
      <AuthHeading title={title}>{children}</AuthHeading>
      <p className="text-sm">
        <Link href={action.href} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">{action.label}</Link>
      </p>
    </>
  );
}
