// Design system — layout & display primitives (server-safe). Colours come
// from brand tokens in globals.css (Outside In by default, Findable when
// PRODUCT_BRAND=findable).

import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  emphasis,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  /** Optional trailing words rendered in italic with a lime marker. */
  emphasis?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--eyebrow-bg)] px-2.5 py-1 text-ink/80 [&_a]:hover:underline">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--eyebrow-dot)]" aria-hidden />
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[2.15rem] leading-[1.05] text-ink sm:text-[2.6rem]">
          {title}
          {emphasis && (
            <>
              {" "}
              <em className="mark-lime italic">{emphasis}</em>
            </>
          )}
        </h1>
        {description && <div className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div>}
    </header>
  );
}

/** Back-compat alias used by the destination-intelligence pages. */
export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <PageHeader title={title} description={description} eyebrow="Destination intelligence" />;
}

export function Card({
  children,
  className = "",
  title,
  description,
  actions,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-line/70 bg-surface shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2 no-print">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export type StatVariant = "plain" | "orange" | "forest" | "night" | "lime" | "highlight" | "alert";

export function Stat({
  label,
  value,
  sub,
  href,
  tone,
  variant = "plain",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
  variant?: StatVariant;
  /** Small glyph shown in a circular chip, top-right (Niond-style stat card). */
  icon?: ReactNode;
}) {
  const surfaces: Record<StatVariant, string> = {
    plain: "border border-line bg-surface text-ink",
    orange: "bg-brand-soft text-ink",
    forest: "bg-accent-soft text-ink",
    night: "bg-night text-night-ink",
    lime: "bg-lime/20 text-ink",
    highlight: "bg-lime text-lime-ink",
    alert: "border border-danger/60 bg-surface text-ink",
  };
  const chips: Record<StatVariant, string> = {
    plain: "bg-surface-2 text-muted",
    orange: "bg-brand text-brand-ink",
    forest: "bg-accent text-accent-ink",
    night: "bg-lime text-lime-ink",
    highlight: "bg-night text-night-ink",
    alert: "bg-danger-soft text-danger",
    lime: "bg-lime text-lime-ink",
  };
  const valueTone =
    variant === "alert" ? "text-danger" : variant !== "plain" ? "" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink";
  const subTone = variant === "plain" ? "text-subtle" : "opacity-75";
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={cx("eyebrow", variant === "plain" ? "text-muted" : variant === "alert" ? "text-danger" : "opacity-80")}>{label}</p>
        {icon && <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", chips[variant])}>{icon}</span>}
      </div>
      <p className={cx("stat-value mt-3 leading-none tabular-nums", valueTone)}>{value}</p>
      {sub && <p className={cx("mt-2 text-xs", subTone)}>{sub}</p>}
    </>
  );
  const cls = cx("block rounded-2xl p-4 shadow-sm", surfaces[variant]);
  return href ? (
    <Link href={href} className={cx(cls, "transition-transform hover:-translate-y-0.5")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Back-compat alias. */
export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <Stat label={label} value={value} sub={sub} />;
}

export type Tone = "neutral" | "accent" | "brand" | "success" | "warning" | "danger" | "info" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-1 ring-inset ring-line",
  accent: "bg-lime text-lime-ink",
  brand: "bg-brand-soft text-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  outline: "text-muted ring-1 ring-inset ring-line-strong",
};

// Legacy access-level tones used by destination pages.
const LEGACY: Record<string, Tone> = {
  PUBLIC: "success", PARTNER: "info", PRIVATE_BUSINESS: "warning", AGGREGATED: "accent", MODEL_INFERENCE: "neutral",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone | string; title?: string }) {
  const t = (TONES as Record<string, string>)[tone] ? (tone as Tone) : LEGACY[tone] ?? "neutral";
  return (
    <span
      title={title}
      className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", TONES[t])}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  needs,
  children,
  action,
}: {
  title: string;
  needs?: string[];
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2 px-5 py-6 text-sm">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {needs && needs.length > 0 && (
        <>
          <p className="mt-1 text-muted">This section needs:</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative -mx-px overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "dark";
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger" | "dark" = "secondary", size: "sm" | "md" = "md") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sz = size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm";
  const v = {
    primary: "bg-primary text-primary-ink shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)] hover:brightness-95",
    dark: "bg-night text-night-ink hover:opacity-90",
    secondary: "border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-canvas",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
    danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
  }[variant];
  return cx(base, sz, v);
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{it.label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-ink">
            {it.value === null || it.value === undefined || it.value === "" ? <span className="text-subtle">—</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto no-print" aria-label="Sections">
      {tabs.map((t) => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors",
              active ? "bg-night font-medium text-night-ink" : "text-muted hover:bg-surface hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cx("ml-1.5 font-mono text-xs", active ? "text-lime" : "text-subtle")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const cls = {
    info: "border-info/25 bg-info-soft text-info",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-success/25 bg-success-soft text-success",
  }[tone];
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", cls)}>{children}</div>;
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-meter" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function TextBlock({ children }: { children?: string | null }) {
  if (!children) return <span className="text-subtle">—</span>;
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{children}</p>;
}
