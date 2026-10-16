import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Page not found" };

// Unknown addresses and records (anything that calls notFound()).
export default function NotFound() {
  return (
    <AuthShell panelTitle="Not found.">
      <AuthHeading title="We can't find that page">The link may be out of date, or the page may have moved. If you followed a link from us, let us know.</AuthHeading>
      <p className="text-sm"><Link href="/" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Go to your home page</Link></p>
      <SiteFooter className="mt-8 border-t border-line pt-4" />
    </AuthShell>
  );
}
