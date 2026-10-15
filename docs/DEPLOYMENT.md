# Deploying to Vercel + Supabase

Target setup: **Supabase Postgres in Sydney (ap-southeast-2)** and **Vercel
functions in Sydney (`syd1`, set in `vercel.json`)**. About 30–45 minutes the
first time. You need: a Supabase account, a Vercel account (Pro plan — the
free Hobby plan does not allow commercial use), and access to the GitHub repo
`anigemmill/Tourism-AI-Growth-Platform`.

> Plan choice: use **Supabase Pro** before real operator data goes in. Free
> projects pause after a week of inactivity and do not include daily backups.

---

## 1. Supabase — create the database

1. **New project** → name `growth-os` → **Region: Asia-Pacific (Sydney)** →
   generate a strong database password and store it in your password manager.
2. **Turn off the Data API** (the app never uses it):
   Project Settings → **Data API** → disable it (or remove `public` from
   *Exposed schemas*). As a second line of defence the app's migrations enable
   row-level security on every table, which blocks that API even if it is on.
3. **Get two connection strings**: click **Connect** (top of the dashboard) →
   *ORMs* / *Connection string*:
   - **Transaction pooler** (host `…pooler.supabase.com`, port **6543**) →
     this is `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1`.
   - **Session pooler** (same pooler host, port **5432**) → this is
     `DIRECT_URL` (used only for migrations). Use the session pooler rather
     than the "direct connection", which is IPv6-only unless you buy the IPv4
     add-on.
   Replace `[YOUR-PASSWORD]` in both with the database password (drop the
   brackets). If the password contains `#`, `/`, `?` or a space, either
   percent-encode those characters (`#`→`%23`, `/`→`%2F`, `?`→`%3F`,
   space→`%20`) or reset it to letters and digits only — otherwise Prisma
   rejects the URL with `P1013`.

   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
   ```
4. Turn on **MFA** for your Supabase account (Account → Security).

## 2. Vercel — create the project

1. **Add New → Project** → import `anigemmill/Tourism-AI-Growth-Platform`.
   Framework preset: Next.js (auto-detected). Leave build/output settings at
   their defaults — Vercel runs the repo's `vercel-build` script, which
   applies database migrations on production deploys and then builds.
2. **Environment variables** (Settings → Environment Variables). Set these for
   **Production only**:

   Paste only the URL itself: no surrounding quotes, no `DATABASE_URL=`
   prefix, no trailing space or line break (the quoted form above is `.env`
   syntax, not what the dashboard field takes).

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Transaction pooler URL from step 1.3 |
   | `DIRECT_URL` | Session pooler URL from step 1.3 |
   | `SETUP_TOKEN` | A long random string, e.g. output of `openssl rand -base64 32` (at least 24 characters) |

   Do **not** add `SEED_DEMO` or any `SEED_*` variables.

   Preview deployments: either leave the database variables unset for
   Preview (previews will show errors on data pages — fine), or create a
   second, disposable Supabase project for staging and use its URLs for
   Preview. Never point previews at the production database: previews skip
   migrations, and anyone with a preview link could reach live data.
3. **Production branch** (Settings → Git): the repo currently has one branch,
   `claude/sweet-clarke-h6j8dd`. Either set that as the production branch, or
   (recommended) create a `main` branch from it in GitHub, make `main` the
   default branch, and set `main` as Vercel's production branch.
4. **Deployment protection** (Settings → Deployment Protection): enable
   Vercel Authentication for Preview deployments.
5. **Deploy.** In the build log you should see
   `Applying database migrations (production)…` followed by
   `All migrations have been successfully applied.`

## 3. First run — create your founder account

1. Open `https://<your-project>.vercel.app/setup`.
2. Enter the `SETUP_TOKEN`, your name, email, a password (12+ characters) and,
   optionally, the programme's week-1 date.
3. You're sent to the sign-in page. Sign in.
4. **Remove `SETUP_TOKEN`** from Vercel's environment variables. (Setup is
   already locked because a user exists; removing the token is belt and braces.)

Setup creates only: your founder account, the Rotorua destination reference
data, the 12-week programme skeleton, solution templates and the workflow
library records. No demo data, no operators.

## 4. Domain (optional)

Vercel → Settings → Domains → add e.g. `os.outsidein.co.nz` and create the DNS
record Vercel shows (CNAME to `cname.vercel-dns.com`). HTTPS is automatic and
required — the session cookie is `Secure` in production.

## 5. Day-to-day

- **Deploying changes:** push to the production branch. Migrations run
  automatically; if one fails, the build fails and the previous version stays
  live.
- **Rollback:** Vercel → Deployments → previous deployment → *Promote to
  Production*. Note database migrations are forward-only; a rollback of code
  does not undo a migration. Prefer additive migrations.
- **Backups:** Supabase Pro takes daily backups (Database → Backups). For
  extra safety, download a full export monthly from the app
  (*Data export → Download everything*) and store it securely.
- **Adding people:** Users & access (founder only). Operators get an
  operator account linked to their business.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check,
  unit tests, database integration tests and a build on every push.

## 6. Security checklist before real operators

- [ ] Supabase Pro, Sydney region, Data API disabled, MFA on.
- [ ] Vercel Pro, env vars Production-only, preview protection on.
- [ ] Founder account created; `SETUP_TOKEN` removed.
- [ ] Demo data never seeded on this database.
- [ ] Data storage location (Australia) stated in operator data agreements.
- [ ] Privacy statement, retention schedule and correction process agreed
      (see `docs/GROWTH_OS.md` §7).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails: `DATABASE_URL and DIRECT_URL must be set` | Env vars missing for Production |
| Build fails: `P1013 The provided database string is invalid` | Malformed `DATABASE_URL`/`DIRECT_URL`: quotes or `NAME=` pasted into the value, leading/trailing whitespace, unencoded `#` `/` `?` in the password, or a non-Postgres URL. The build now prints which one (never the password) before running migrations |
| Build fails at migrations: `P1001 can't reach database` | Used the IPv6 direct host for `DIRECT_URL` — use the session pooler; or wrong password |
| Runtime: `prepared statement "s0" already exists` | `DATABASE_URL` missing `?pgbouncer=true` |
| Runtime: too many connections | `DATABASE_URL` missing `connection_limit=1`, or using the session pooler (5432) instead of the transaction pooler (6543) at runtime |
| `/setup` shows 404 | A user already exists, or `SETUP_TOKEN` is unset/shorter than 24 characters |
| Pages slow (>1 s) | Vercel function region not Sydney — check `vercel.json` is deployed and the Supabase region |
