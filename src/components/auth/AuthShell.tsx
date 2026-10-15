// Split-screen frame shared by /login and /setup: warm gradient brand panel
// on the left, white form panel on the right. Stacks on small screens with a
// compact brand header so the form stays first-class on mobile.

import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-stretch justify-center bg-canvas sm:items-center sm:p-6 lg:p-10">
      <div className="grid w-full max-w-[1120px] overflow-hidden bg-surface sm:rounded-[28px] sm:border sm:border-line sm:shadow-[0_30px_70px_-35px_rgba(22,22,22,0.35)] lg:min-h-[680px] lg:grid-cols-[46fr_54fr]">
        <BrandPanel />
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
          <div className="w-full max-w-[380px]">{children}</div>
        </section>
      </div>
    </main>
  );
}

// Text colours are fixed (not theme tokens): the gradient is light in both
// colour schemes, so near-black ink keeps ≥7:1 contrast over its darkest stop.
function BrandPanel() {
  return (
    <section aria-label="Tourism AI Growth OS" className="auth-gradient relative flex flex-col justify-between gap-8 overflow-hidden p-6 text-[#161616] sm:p-10 lg:p-12">
      <div className="relative">
        <p className="text-[15px] font-semibold tracking-tight">
          Outside In<span className="text-[#c2410c]">.</span>
        </p>
        <p className="font-display text-lg italic leading-tight text-[#161616]/75">Tourism AI Growth OS</p>
      </div>
      <div className="relative">
        <p className="eyebrow mb-4 text-[#161616]/75">Rotorua Tourism AI Growth Pilot</p>
        <h1 className="font-display text-[34px] leading-[1.05] sm:text-5xl lg:text-[56px]">
          Smarter insights. <em className="italic">Stronger tourism businesses.</em>
        </h1>
        <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-[#161616]/80 sm:block">
          Your hub for tourism intelligence, practical AI tools, and business growth.
        </p>
      </div>
      <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-white/35 blur-2xl" />
    </section>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-[40px] leading-tight text-ink">{title}</h2>
      {children && <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

// Dark, softly rounded primary action. bg-night stays dark in both schemes.
export const authButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-night px-4 text-sm font-medium text-night-ink shadow-[0_8px_20px_-10px_rgba(22,22,22,0.6)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export const authInputClass =
  "block h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-subtle transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 aria-[invalid=true]:border-danger";

export const authLabelClass = "mb-1.5 block text-[13px] font-medium text-ink";
