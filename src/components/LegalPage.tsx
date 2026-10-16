import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brand";
import { legalDoc, type LegalDocId } from "@/lib/legal";
import { Markdown } from "@/components/Markdown";
import { SiteFooter } from "@/components/SiteFooter";

export function legalMetadata(id: LegalDocId): Metadata {
  return { title: legalDoc(id)?.title ?? "Not found" };
}

/** Public page for one legal document; 404 until the text is publishable. */
export function LegalPage({ id }: { id: LegalDocId }) {
  const doc = legalDoc(id);
  if (!doc) notFound();
  const brand = getBrand();
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="mb-8 flex items-center justify-between gap-4 text-sm">
          <span className="wordmark text-xl">{brand.name}<span style={{ color: "var(--wordmark-dot)" }}>.</span></span>
          <Link href="/login" className="text-muted underline underline-offset-4 hover:text-ink">Sign in</Link>
        </p>
        <article className="rounded-2xl border border-line bg-surface p-6 sm:p-10">
          <Markdown source={doc.body} />
        </article>
        <SiteFooter className="mt-8" />
      </div>
    </main>
  );
}
