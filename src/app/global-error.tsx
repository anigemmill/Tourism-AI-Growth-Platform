"use client";

// Last-resort error page when the root layout itself fails. It replaces the
// whole document, so it can't use the app's stylesheet: plain inline styles.

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-NZ">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#f6f6f4", color: "#161616" }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: 440, margin: "15vh auto", padding: "0 20px" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong.</h1>
          <p style={{ lineHeight: 1.6, color: "#555" }}>
            The service couldn&apos;t load this page. Please try again in a moment. If it keeps happening, contact the programme team
            {error.digest ? <> and quote reference <code>{error.digest}</code></> : null}.
          </p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 12, border: 0, background: "#161616", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
