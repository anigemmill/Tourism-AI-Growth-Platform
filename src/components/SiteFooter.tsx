// Links to the published legal pages and the support address. Shows nothing
// until at least one exists (see src/lib/legal.ts).

import Link from "next/link";
import { publishedLegalDocs, supportEmail } from "@/lib/legal";

export function SiteFooter({ className = "" }: { className?: string }) {
  const docs = publishedLegalDocs();
  const email = supportEmail();
  if (docs.length === 0 && !email) return null;
  return (
    <nav aria-label="Legal and support" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle ${className}`}>
      {docs.map((d) => <Link key={d.href} href={d.href} className="underline underline-offset-4 hover:text-ink">{d.title}</Link>)}
      {email && <a href={`mailto:${email}`} className="underline underline-offset-4 hover:text-ink">Contact {email}</a>}
    </nav>
  );
}
