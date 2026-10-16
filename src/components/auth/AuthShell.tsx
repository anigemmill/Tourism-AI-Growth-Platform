// Split-screen frame for sign-in and account pages. Brand-aware:
// - Outside In (pilot): warm gradient panel on the left, white form panel.
// - Findable: near-black panel with a large heading, lavender form side
//   (Findable wireframe "04 Sign in").
// Stacks on small screens with the brand panel compact so the form stays
// first-class on mobile.

import type { ReactNode } from "react";
import { getBrand, type Brand } from "@/lib/brand";

export { authButtonClass, authInputClass, authLabelClass } from "./styles";

export function AuthShell({ children, panelTitle }: { children: ReactNode; panelTitle?: string }) {
  const brand = getBrand();
  if (brand.id === "findable") {
    return (
      <main className="grid min-h-screen bg-canvas lg:grid-cols-[35fr_65fr]">
        <FindablePanel brand={brand} title={panelTitle ?? "Be the answer."} />
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 sm:py-14">
          <div className="w-full max-w-[420px]">{children}</div>
        </section>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen items-stretch justify-center bg-canvas sm:items-center sm:p-6 lg:p-10">
      <div className="grid w-full max-w-[1120px] overflow-hidden bg-surface sm:rounded-[28px] sm:border sm:border-line sm:shadow-[0_30px_70px_-35px_rgba(22,22,22,0.35)] lg:min-h-[680px] lg:grid-cols-[46fr_54fr]">
        <GradientPanel />
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
          <div className="w-full max-w-[380px]">{children}</div>
        </section>
      </div>
    </main>
  );
}

function FindablePanel({ brand, title }: { brand: Brand; title: string }) {
  // "Welcome back." → heading with a lime full stop, like the wordmark.
  const body = title.endsWith(".") ? title.slice(0, -1) : title;
  return (
    <section aria-label={brand.name} className="auth-night relative flex flex-col justify-between gap-8 overflow-hidden p-6 text-[#fffff2] sm:p-10 lg:p-12">
      <p className="wordmark text-[26px] leading-none">
        {brand.name}<span className="text-[#d6f36b]">.</span>
      </p>
      <h1 className="font-display text-[44px] leading-[0.95] sm:text-6xl lg:text-[76px]">
        {body}
        {title.endsWith(".") && <span className="text-[#d6f36b]">.</span>}
      </h1>
      <p className="hidden max-w-sm text-sm leading-relaxed text-[#c9cacf] sm:block">{brand.tagline}</p>
    </section>
  );
}

// Text colours are fixed (not theme tokens): the gradient is light in both
// colour schemes, so near-black ink keeps ≥7:1 contrast over its darkest stop.
function GradientPanel() {
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

export function AuthHeading({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="eyebrow mb-2 text-accent">{eyebrow}</p>}
      <h2 className="font-display text-[40px] leading-tight text-ink">{title}</h2>
      {children && <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
