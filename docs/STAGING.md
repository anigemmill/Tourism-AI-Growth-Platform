# Staging database for Vercel previews

Preview deployments have no database by default, so pages that need data
can't be reviewed there. A **separate** staging database fixes that without
going near production.

## One-time setup (you do this; secrets never go in chat or the repo)

1. **Create a staging Supabase project.** Supabase → New project, e.g.
   `findable-staging`, region Sydney (`ap-southeast-2`), its own strong
   database password. Never reuse the production project.
2. In the staging project, copy the two connection strings (Connect → ORMs →
   Prisma): the transaction pooler URL (port 6543) and the session pooler URL
   (port 5432).
3. **Vercel → Settings → Environment Variables**, add each of these with
   **Environment = Preview only** (untick Production and Development):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Staging transaction pooler URL (6543) |
   | `DIRECT_URL` | Staging session pooler URL (5432) |
   | `STAGING_DATABASE` | `true` |
   | `STAGING_SEED_DEMO` | `true` (optional: seeds the synthetic demo cohort once) |
   | `SEED_FOUNDER_EMAIL` | A test super-admin email for staging |
   | `SEED_FOUNDER_PASSWORD` | A test password (12+ characters), staging only |
   | `SEED_DEMO_PASSWORD` | Password for the demo admin/operator accounts, staging only |
   | `PRODUCT_BRAND` | `findable` (optional: previews show the Findable brand) |

4. Redeploy the preview (push to the branch, or Vercel → Deployments →
   Redeploy).

## What the build does

`scripts/vercel-build.mjs` on a **preview** build:

- does nothing to any database unless `STAGING_DATABASE=true`;
- **refuses to run** if either URL points at the production Supabase project
  (`PRODUCTION_DB_REF` in `scripts/database-url.mjs`);
- validates the URLs, applies migrations to staging, and — only when
  `STAGING_SEED_DEMO=true` and the staging database has no users — seeds the
  synthetic demo cohort (`scripts/staging-seed.ts`), which also refuses to
  run against production.

Production builds are unchanged: they migrate the production database only.

## Rules

- Staging holds synthetic data only. Never copy production data into it.
- Staging passwords are separate from production and can be rotated freely.
- To reset staging, delete and recreate the staging project's tables (or the
  whole project) — never run anything against production.
