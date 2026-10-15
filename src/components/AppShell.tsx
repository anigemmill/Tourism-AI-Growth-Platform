"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; badge?: string }[];
}

export function AppShell({
  nav,
  user,
  logoutAction,
  children,
  productLabel,
}: {
  nav: NavGroup[];
  user: { name: string; roleLabel: string; context?: string };
  logoutAction: () => Promise<void>;
  children: ReactNode;
  productLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" || href === "/portal" ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <p className="text-[15px] font-semibold tracking-tight text-ink">
          Outside In<span className="text-brand">.</span>
        </p>
        <p className="font-display mt-0.5 text-lg italic leading-tight text-muted">{productLabel}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((g, i) => (
          <div key={i} className="mb-4">
            {g.label && <p className="eyebrow mb-1.5 px-3 text-subtle">{g.label}</p>}
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
                        "flex items-center justify-between rounded-full px-3 py-1.5 text-[13px] transition-colors",
                        active ? "bg-lime font-medium text-lime-ink" : "text-muted hover:bg-surface hover:text-ink"
                      )}
                    >
                      <span>{item.label}</span>
                      {item.badge && <span className={cx("rounded-full px-1.5 font-mono text-[9px] uppercase tracking-wide", active ? "bg-night text-night-ink" : "bg-lime/60 text-lime-ink")}>{item.badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-surface px-4 py-3">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-subtle">
          {user.roleLabel}
          {user.context ? ` · ${user.context}` : ""}
        </p>
        <form action={logoutAction} className="mt-2">
          <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden no-print">
        <p className="text-sm font-semibold">Outside In<span className="text-brand">.</span> <span className="font-display text-base font-normal italic text-muted">{productLabel}</span></p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-full border border-ink/80 px-3 py-1 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-0 top-[53px] z-20 bg-canvas lg:hidden">
          {sidebar}
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-canvas lg:block no-print">{sidebar}</aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
