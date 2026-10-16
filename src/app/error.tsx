"use client";

// Fallback for unexpected errors below the root layout. In production the
// message from a server error is withheld by Next.js; the reference (digest)
// matches the server log entry, so support can find it.

import Link from "next/link";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
        <p className="eyebrow mb-2 text-accent">Something went wrong</p>
        <h1 className="font-display text-3xl leading-tight text-ink">That didn&apos;t work.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The last step may not have been saved, so check it before carrying on. Try again, and if it keeps happening, contact the programme team
          {error.digest ? <> and quote reference <code className="text-ink">{error.digest}</code></> : null}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="rounded-xl bg-night px-4 py-2 text-sm font-medium text-night-ink hover:opacity-90">Try again</button>
          <Link href="/" className="rounded-xl border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2">Go to your home page</Link>
        </div>
      </div>
    </main>
  );
}
