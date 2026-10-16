# Findable — Phase 1: visual refresh & navigation

Design reference: *Findable — Dashboard & Admin* and *Findable — Website
Mockups* wireframes. Branch: `claude/findable-phase-1` (from production
`main` at `d1d7454`).

## Principles

- Same application, same data, same security. No rebuild.
- The Rotorua pilot keeps working: brand is a deployment setting
  (`PRODUCT_BRAND`), defaulting to **Outside In** so production looks and
  reads as it does today until a brand switch is approved.
- No database changes in Phase 1 (no migrations).
- Not in Phase 1: public marketing site, free check, self-service sign-up,
  Google sign-in, "keep me signed in", Stripe, the AI testing engine, AI
  answers / competitors / accuracy-alert pages, fix-pack jobs, leads,
  "view as client".

## Scope

1. **Brand & design tokens.** `PRODUCT_BRAND=findable` switches wordmark,
   product name, page titles, fonts (Inter / Inter Tight / JetBrains Mono)
   and colour tokens (lavender canvas, cream cards, near-black client
   sidebar, forest-green back-office sidebar, lime highlight). Default
   `outside-in` keeps today's look. All pages pick this up through the
   shared components and tokens; no per-page restyling of pilot screens.
2. **Client (operator) portal** — wireframe information architecture using
   existing data only:
   - Sidebar: business card (initials, name, category), nav, user card.
   - **Overview** (`/portal`): greeting, stat tiles (open actions, roadmap
     items, experiments, latest brief), "your top 3 moves" from the
     existing roadmap, existing update form and assessment.
   - **Action plan** (`/portal/plan`, new page): roadmap opportunities and
     tasks with progress and All / To do / Done filters (wireframe
     "Outrank plan" layout).
   - **Reports** (`/portal/reports`, new page): shared weekly growth briefs.
   - **Account & team** (`/portal/account`): tabs Business (read-only
     profile), Team (people linked to *this* business, read-only), Billing
     (this business's subscription and invoices, read-only, labelled
     manually recorded), Security (password, email, sessions — existing).
   - Growth Collective stays, behind its existing per-business switch.
3. **Back office (staff)** — wireframe navigation and overview:
   - Nav group "Back office": Overview, Clients, Billing, Users & access,
     Roles & permissions; pilot programme sections unchanged below it.
   - **Overview** (`/admin`): "Business at a glance" tiles and a
     "Needs you today" list built from existing data (pending invitations,
     overdue invoices, failed payments, locked accounts, suspended clients).
4. **Sign-in and account pages** — wireframe split layout (dark brand panel
   with large heading, form on the right) when the brand is Findable.
   Email + password, "Forgot password?" beside the password label. No
   Google button and no "Create an account" link (not available yet).
5. **Staging database support** — previews can be pointed at a separate
   staging database. Preview builds migrate it only when explicitly enabled
   and never when the URL points at the production project.

## Affected pages

| Area | Pages |
|---|---|
| Shared | `layout.tsx` (brand, fonts, titles), `globals.css` (tokens), `AppShell`, `AuthShell`, UI primitives (buttons, page header, stat tiles, tabs) |
| Portal | `/portal`, `/portal/plan` (new), `/portal/reports` (new), `/portal/account` (tabs), portal layout/nav |
| Back office | `/admin` overview, staff navigation labels |
| Auth | `/login`, `/forgot-password`, `/reset-password`, `/invite`, `/verify-email`, `/setup`, `/no-access` (shell only) |
| Build | `scripts/vercel-build.mjs` (opt-in preview migrations with production guard) |

Every other staff page changes only through shared components and tokens.

## Database changes

None. New portal views read existing tables through the session-scoped
portal data layer (`src/lib/dal/portal.ts`): the business id always comes
from the signed-in user's validated membership, never from the request.

## Acceptance checklist

Security & behaviour (must not regress)
- [ ] No migrations added; `prisma migrate diff` shows no drift.
- [ ] Every new page/action calls the existing auth guards
      (`requireOperator` / `requirePermission`); no new API routes.
- [ ] New portal queries are scoped by the session's business; an
      integration test proves operator A can't see B's team or billing.
- [ ] Billing tab never shows admin notes or another business's records;
      every amount is labelled "Manually recorded".
- [ ] Sign-in, invitations, password reset, email confirmation, sessions,
      audit logging and the last-super-admin guard behave exactly as before
      (existing integration and end-to-end suites pass).
- [ ] No public registration, Google sign-in, Stripe or AI-testing code.

Brand
- [ ] With `PRODUCT_BRAND` unset, the app still shows "Outside In" /
      "Tourism AI Growth OS".
- [ ] With `PRODUCT_BRAND=findable`, wordmark, titles, fonts and colours
      follow the wireframes; no "Outside In" text remains in shared chrome.

Design
- [ ] Portal: sidebar business card, nav (Overview, Action plan, Reports,
      Growth Collective when enabled, Account & team), user card.
- [ ] Portal overview, action plan, reports and account tabs match the
      wireframe layout using real data, with honest empty states.
- [ ] Back office: "Back office" nav group; overview shows "Business at a
      glance" tiles and "Needs you today".
- [ ] Sign-in matches the wireframe split layout (Findable brand).
- [ ] Layout works at 390 px (mobile) and 1440 px; keyboard focus visible;
      text contrast ≥ 4.5:1.

Delivery
- [ ] Lint, type check, unit, integration and end-to-end tests pass.
- [ ] Preview deployment builds; screenshots of each changed page shared.
- [ ] Nothing merged to `main`, deployed to production, or written to the
      production database without explicit approval.
