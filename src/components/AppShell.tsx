"use client";

// Application frame shared by the staff back office and the operator portal.
// Colours come from sidebar tokens in globals.css, so the same markup renders
// the pilot (Outside In) look or the Findable wireframe look.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { NavIcon, type NavIconName } from "@/components/NavIcon";

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; badge?: string; icon?: NavIconName }[];
}

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase() || "·";
}

export function AppShell({
  nav,
  user,
  logoutAction,
  children,
  productLabel,
  brandName,
  variant = "backoffice",
  business,
  sectionLabel,
}: {
  nav: NavGroup[];
  user: { name: string; roleLabel: string; context?: string };
  logoutAction: () => Promise<void>;
  children: ReactNode;
  productLabel: string;
  brandName: string;
  /** "client" = operator portal, "backoffice" = staff. */
  variant?: "client" | "backoffice";
  /** Operator portal: the business currently in use. */
  business?: { name: string; detail?: string };
  /** Small pill above the nav, e.g. "Back office". */
  sectionLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Highlight the most specific matching item only (e.g. /support/x/account,
  // not also /support/x). Root-like sections match exactly.
  const matches = (href: string) =>
    href === "/" || href === "/portal" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const best = nav.flatMap((g) => g.items.map((i) => i.href)).filter(matches).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === best;
  const wordmark = (
    <span className="wordmark text-[22px] leading-none">
      {brandName}
      <span className="wordmark-dot">.</span>
    </span>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <p className="text-sidebar-ink">{wordmark}</p>
        {productLabel !== brandName && <p className="font-display mt-1 text-[15px] leading-tight text-sidebar-muted">{productLabel}</p>}
        {sectionLabel && (
          <p className="eyebrow mt-3 inline-block rounded-full bg-sidebar-active px-2 py-0.5 text-sidebar-active-ink">{sectionLabel}</p>
        )}
      </div>
      {business && (
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-xl bg-sidebar-card px-3 py-2.5">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-active text-xs font-bold text-sidebar-active-ink">
            {initials(business.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-sidebar-ink">{business.name}</span>
            {business.detail && <span className="block truncate text-xs text-sidebar-muted">{business.detail}</span>}
          </span>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((g, i) => (
          <div key={i} className="mb-4">
            {g.label && <p className="eyebrow mb-1.5 px-3 text-sidebar-subtle">{g.label}</p>}
            <ul className="space-y-px">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-[13.5px] transition-colors",
                        active ? "bg-sidebar-active font-semibold text-sidebar-active-ink" : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        {item.icon && <NavIcon name={item.icon} />}
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={cx("rounded-full px-1.5 font-mono text-[9px] uppercase tracking-wide", active ? "bg-night text-night-ink" : "bg-lime/60 text-lime-ink")}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-xl bg-sidebar-card px-3 py-3">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet text-xs font-semibold text-[#15161a]">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-ink">{user.name}</p>
          <p className="truncate text-xs text-sidebar-subtle">
            {user.roleLabel}
            {user.context ? ` · ${user.context}` : ""}
          </p>
          <form action={logoutAction} className="mt-1">
            <button type="submit" className="text-xs text-sidebar-muted underline-offset-2 hover:text-sidebar-ink hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div data-shell={variant} className="min-h-screen bg-canvas lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-ink lg:hidden no-print">
        <p className="flex items-baseline gap-2">
          {wordmark}
          {productLabel !== brandName && <span className="font-display text-sm text-sidebar-muted">{productLabel}</span>}
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-full border border-sidebar-muted px-3 py-1 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-0 top-[53px] z-20 bg-sidebar lg:hidden">
          {sidebar}
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-line bg-sidebar lg:block no-print">{sidebar}</aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
