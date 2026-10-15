# Accounts, roles & permissions

How people get into Tourism AI Growth OS and what they can do there.

## Roles

| Role (code) | Shown as | Default access |
|---|---|---|
| `FOUNDER` | Super Admin | Everything, always. Cannot be restricted. |
| `ADMIN` | Platform Staff | Programme delivery (view + edit), data import/connectors, audit log, data export, business directory (read). |
| `PROGRAMME_MANAGER` | Programme Manager | Programme delivery (view + edit), business directory (read). |
| `ANALYST` | Read-only / Analyst | Programme delivery and reports, read-only. |
| `OPERATOR` | Tourism Operator | Operator portal for their own linked business(es) and cohort-shared content. |

Existing database values were kept (`FOUNDER`, `ADMIN`, `OPERATOR`), so
production data needed no role conversion.

## Permissions

The catalogue lives in `src/lib/rbac/permissions.ts`: one permission per
dashboard, per module (view / edit) and per sensitive action (export, users,
roles, businesses, billing).

Effective permissions = role defaults → role overrides (Administration →
Roles & permissions) → per-user grant/deny (a user's page). Rules that can't
be overridden:

- Super Admins hold every permission.
- Only Super Admins can assign roles or permissions (`users.roles`).
- Tourism Operators can only hold operator-portal permissions. Staff
  permissions bypass per-business data scoping, so they can never be given
  to an operator.

Enforcement is server-side. Every page, server action and API route calls
`requirePermission(...)` or `can(...)` (`src/lib/auth/session.ts`). The
navigation only hides links. Operators' data is always scoped to a business
taken from their session and re-checked against their memberships on every
request (`usableBusinessFor` in `src/lib/auth/core.ts`). Changing an ID in a
URL, form or API call can't reach another business.

## Account lifecycle

| Status | Meaning |
|---|---|
| Invited (`PENDING`) | Invitation sent; no password yet; cannot sign in. |
| Active | Can sign in. |
| Suspended | Temporarily blocked; signed out everywhere; can be reactivated. |
| Deactivated (`ARCHIVED`) | Retired; signed out everywhere; records kept; can be reactivated. |

- **Invite:** Administration → Users. The person gets a single-use link
  (valid 7 days) and sets their own password. You can resend an invitation
  (this invalidates the old link) or revoke it.
- **Password reset:** users click "Forgotten your password?" on the sign-in
  page, or an admin sends a reset link from the user's page. Links are
  single-use and expire after 1 hour. A reset signs the user out everywhere.
- **Change password / sessions:** each user's *My account* page lets them
  change their password (other devices are signed out), confirm their email,
  and sign out individual devices.
- **Never:** nobody can see, choose or retrieve another person's password.
  Tokens are stored only as SHA-256 hashes.
- **Without email configured**, a Super Admin is shown the single-use link
  once, to hand over in person. Nothing is logged or stored in readable
  form.

Safety rails:

- You can't change your own role or status.
- The last active Super Admin can't be suspended, deactivated or demoted.
  This is checked in a serializable transaction, so two admins acting at
  once can't both succeed.
- Status, role, permission, business-link and billing changes need a
  confirmation tick that the server checks.
- All of these changes are written to the audit log.
- Rate limits apply to sign-in (per email and per IP), forgotten-password
  requests (per IP and per address), token submission, password changes
  and invitations.

## Businesses

Each business (an `Operator` record) has an account status (pending, active,
suspended, archived), a programme and cohort, and enabled portal features.
Users link to businesses many-to-many (`UserBusiness`); an operator linked
to several businesses switches between them on *My account*. Suspending or
archiving a business blocks its operators' portal access on their next
request.

## First super admin & recovery

- **Bootstrap:** `/setup` works only while `SETUP_TOKEN` is set and no user
  exists. It isn't linked anywhere. Remove `SETUP_TOKEN` afterwards. See
  `docs/DEPLOYMENT.md`.
- **Recovery** (nobody can sign in as Super Admin): someone with the
  production `DATABASE_URL` runs the following on their own machine:

  ```sh
  DATABASE_URL=... npx tsx scripts/admin-recovery.ts list
  DATABASE_URL=... APP_URL=https://... npx tsx scripts/admin-recovery.ts reset-link you@example.com
  DATABASE_URL=... npx tsx scripts/admin-recovery.ts promote colleague@example.com --yes
  ```

  The script issues a single-use reset link, or promotes an existing account.
  It never handles passwords, and it is audited. There is deliberately no web
  endpoint for this.
- Keep at least two Super Admins.
