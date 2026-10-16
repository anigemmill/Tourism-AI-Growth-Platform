# Staging database for Vercel previews

Preview deployments have no database by default, so pages that need data
can't be reviewed there. A **separate** staging Supabase project fixes that
without going near production.

You create the project and enter the secrets yourself. Never paste a
password or connection string into chat, an issue or the repository.

## 1. Create the staging Supabase project

1. Supabase dashboard → your organisation → **New project**.
   - Name: `findable-staging` (anything that clearly isn't production).
   - Database password: click **Generate a password**, then store it in your
     password manager. It's used only for staging. Never reuse the
     production password.
   - Region: **Sydney (`ap-southeast-2`)**, same as production.
   - Plan: the Free plan is enough for review. If the organisation already
     has two free projects, Supabase asks you to upgrade or pick another
     organisation; that is a billing decision for you.
2. Wait until the project shows as healthy (about 2 minutes).
3. Check you are in the **staging** project: its project ref (Project
   Settings → General → Reference ID, also in the browser URL) must **not**
   be `hescoabpcjukmgeopjnq`. That ref is production.

## 2. Copy the two connection strings (keep them out of chat)

In the staging project, click **Connect** (top bar) → **ORMs** → **Prisma**.
It shows two lines:

| Supabase shows | Use it for | Looks like |
|---|---|---|
| `DATABASE_URL` (Transaction pooler, port **6543**) | `DATABASE_URL` | `postgresql://postgres.<staging-ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` (Session pooler, port **5432**) | `DIRECT_URL` | `postgresql://postgres.<staging-ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres` |

Replace `[YOUR-PASSWORD]` (brackets included) with the staging password. If
the password has characters like `@ # / ? %`, URL-encode them (for example
`#` → `%23`), or generate a new password without them (Project Settings →
Database → Reset database password).

## 3. Add Preview-only variables in Vercel

Vercel → project **tourism-ai-growth-platform** → **Settings → Environment
Variables** → **Add new**. For **each** row below:

- **Environments:** tick **Preview only**. Untick Production and Development.
- **Branch:** next to Preview, choose a specific Git branch and enter
  `claude/findable-phase-1`. Other branches then keep running without a
  database.
- For passwords and URLs, turn on **Sensitive** so the value can't be read
  back later.

| Name | Value | Who provides it |
|---|---|---|
| `DATABASE_URL` | Staging transaction pooler URL (port 6543), from step 2 | You (secret) |
| `DIRECT_URL` | Staging session pooler URL (port 5432), from step 2 | You (secret) |
| `STAGING_DATABASE` | `true` | Plain value |
| `STAGING_SEED_DEMO` | `true` (seeds the synthetic demo cohort once) | Plain value |
| `SEED_FOUNDER_EMAIL` | Email for the staging Super Admin, e.g. a `+staging` alias of yours | You |
| `SEED_FOUNDER_PASSWORD` | A new password of 12+ characters, used only on staging | You (secret) |
| `SEED_DEMO_PASSWORD` | A new password of 12+ characters for the demo admin and operator accounts, used only on staging | You (secret) |
| `PRODUCT_BRAND` | `findable` (already set for this branch) | Already set |

`NEW_LAYOUT` is not needed: it follows the brand, so it's on for Findable.

Don't change any **Production** variable. Production still has
`SETUP_TOKEN`; previews don't need it.

## 4. Redeploy the preview

Vercel → **Deployments** → the latest deployment for
`claude/findable-phase-1` → **⋯ → Redeploy**. Alternatively, push a commit
to the branch. In the build log you should see, in order:

```
Staging safeguard passed: the Preview database URLs do not point at the production project.
Applying database migrations (staging, preview)…
All migrations have been successfully applied.
Seeded staging database with the synthetic demo cohort.
```

## 5. Sign in and review

Open the preview URL. Preview protection is on, so you sign in to Vercel
first. Then use these accounts:

| Account | Email | Password | Sees |
|---|---|---|---|
| Super Admin | your `SEED_FOUNDER_EMAIL` | your `SEED_FOUNDER_PASSWORD` | Back office: Overview, Clients, Billing, Users & access, Roles & permissions, plus the pilot programme pages |
| Platform staff | `admin@demo.example` | your `SEED_DEMO_PASSWORD` | Back office without billing or role management |
| Operator A | `operator1@demo.example` | your `SEED_DEMO_PASSWORD` | Lakeside Retreat Lodge portal |
| Operator B | `operator2@demo.example` | your `SEED_DEMO_PASSWORD` | Redwoods Ridge Bike Tours portal |

All data is synthetic and labelled. Each demo business has a shared weekly
brief, a manually recorded plan, one paid invoice and one open invoice.
Operator B's open invoice is overdue, so "Needs you today" has an entry.

## What protects production

1. **Build guard** (`scripts/vercel-build.mjs`): any non-production build
   whose `DATABASE_URL` or `DIRECT_URL` names the production project
   (`hescoabpcjukmgeopjnq`) **fails before migrations, seeding or
   `next build`**, whether or not `STAGING_DATABASE` is set.
2. **Staging opt-in:** preview builds touch a database only when
   `STAGING_DATABASE=true`. Without it they skip migrations.
3. **Runtime guard** (`src/lib/prisma.ts`): a Preview or Development
   deployment refuses to open a connection to the production project, even
   if a URL were changed after the build.
4. **Seed guard** (`scripts/staging-seed.ts`): refuses to run for
   production URLs, `VERCEL_ENV=production`, or without
   `STAGING_DATABASE=true`. It seeds only an **empty** database (no users),
   so redeploys never duplicate or overwrite anything.
5. **Variable scoping:** staging values are set for Preview on one branch
   only. Production variables are never edited.

Simulated locally before release: preview builds with production-ref URLs
exit with "Refusing to build", the app returns 500 with "Refusing to
connect", and the seed script exits with "Refusing to seed". None of them
opened a connection. A preview build against an empty staging database
migrated, seeded once, and skipped the seed on the second run.

The **Development** environment in Vercel still has `DATABASE_URL`,
`DIRECT_URL` and `SETUP_TOKEN` from project creation. If they point at
production, `vercel dev` / `vercel env pull` would hand production
credentials to a laptop, and the runtime guard now blocks `vercel dev` from
using them. Consider deleting those three Development variables. That is
your call, and it doesn't affect Production.

## Rules

- Staging holds synthetic data only. Never copy production data into it.
- Staging passwords are separate from production and can be rotated freely.
- To reset staging, pause or delete the staging project, or create a fresh
  one and update the two Preview URLs. Never run anything against
  production.
- When the review is done you can delete the staging project and the
  Preview variables; nothing in production depends on them.
