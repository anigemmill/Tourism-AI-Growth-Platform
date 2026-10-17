# Backup and restore

What protects Findable's data, how to restore it, and how to prove the
restore works. Applies to the production Supabase project
(`hescoabpcjukmgeopjnq`, Sydney).

## Layers

| Layer | What | Retention | Status |
|---|---|---|---|
| Supabase daily backups | Whole database, taken by Supabase | 7 days on Pro (none on Free) | Needs **Supabase Pro**, which must be confirmed by the owner |
| Weekly off-site dump | `pg_dump` of the production database, encrypted, stored outside Supabase | 12 weeks (suggested) | Owner task (below) |
| App export | *Data export → Download everything* (JSON) | Monthly | Optional extra; not a full backup (no auth tables) |
| Code | Git history; Vercel deployments | Indefinite | In place |

Targets for the pilot:
- **Data loss:** at most 24 hours (RPO).
- **Service restored:** within 1 business day (RTO).

## Weekly off-site dump (owner, about 5 minutes)

1. Supabase → project `hescoabpcjukmgeopjnq` → **Connect** → copy the
   **Session pooler** connection string. It contains the database password,
   so keep it in your password manager only.
2. On your computer (PostgreSQL 16 client tools installed):
   ```sh
   pg_dump --format=custom --no-owner --no-privileges \
     --file "findable-$(date +%Y-%m-%d).dump" "<session pooler URL>"
   ```
3. Encrypt the file (e.g. store it in an encrypted vault or password-manager
   attachment). Never put it in Git, chat or email.
4. Note the date in the pilot log. Delete dumps older than 12 weeks.

## Restore test (before inviting clients, then quarterly)

This is never done over production. It proves that a backup can be turned
back into a working database.

1. Create a **temporary** Supabase project (any name with `restore-test`),
   Sydney. Note its ref: it must not be `hescoabpcjukmgeopjnq`.
2. Restore into it, using either:
   - **from a dump:**
     `pg_restore --no-owner --no-privileges --dbname "<temp project session URL>" findable-YYYY-MM-DD.dump`
   - **from Supabase backups (Pro):** use "Restore to a new project" if your
     plan offers it. **Do not** use in-place restore on production for a test.
3. Check the restored database:
   - `SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at;`
     must list the same migrations as production;
   - row counts for `User`, `Operator`, `UserBusiness`, `Opportunity`,
     `Task`, `GrowthBrief` and `AuditLog` must match production at the backup
     time (same-day counts from the production SQL editor);
   - `SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;`
     must return 0 (row-level security survived the restore).
4. Optional: point a **local** build at the temporary project and sign in
   (never a Vercel deployment).
5. Delete the temporary project. Record the date, backup used and results in
   the pilot log.

## Real restore (incident)

A real restore is destructive: data written after the backup point is lost.
It needs the owner's explicit decision, recorded in the incident log.

1. Put the app in a safe state:
   - suspend client access if data is wrong, by setting the affected
     businesses to *Suspended* in Back office; or
   - accept downtime.
2. Prefer restoring into a **new** project, then switching Vercel's
   `DATABASE_URL` and `DIRECT_URL` (Production) to it and redeploying.
   This keeps the damaged database for investigation.
3. In-place restore (Supabase → Database → Backups → Restore) only if a new
   project is impossible.
4. After the restore:
   - run the checks in "Restore test" step 3;
   - sign in as Super Admin;
   - confirm a client sees only their own business;
   - check the audit log for the last entries before the backup point.
5. Tell affected clients what was lost (any changes after the backup time)
   and what to re-enter.

## Code rollback vs. data

- Vercel Instant Rollback changes code only, never data.
- Migrations are additive (expand-only), so older code keeps working on the
  newer schema.
- A failed migration rolls back and leaves the previous deployment live.
  Recovery after a failed migration is
  `prisma migrate resolve --rolled-back <name>`, then a fixed deploy, with
  owner approval.
