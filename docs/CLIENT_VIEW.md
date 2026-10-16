# Client view ("View as client")

Super Admins can open any business's portal exactly as its users see it,
and, when needed, make supported changes on the client's behalf.

## Who and where

- Super Admins only (role `FOUNDER`). Checked on the server for every page
  and every action; other staff get "no access", operators go to their own
  portal.
- Entry: **View as client** on Back office → Clients (list and business page).
- Pages: `/support/[businessId]` (Overview), `/plan`, `/reports`, `/account`
  (Business, Team, Billing). The client's "Sign-in & security" tab is left
  out: it would show the Super Admin's own account.
- Data comes from the same tenant-scoped portal queries the client uses: that
  business only, no internal records, no admin notes.

## Read-only by default; edit mode

- Every page shows a banner naming the business and the mode.
- **Turn on edit mode** needs a confirmation and creates a `SupportEditGrant`
  row: this Super Admin + this sign-in session + this business, expiring
  after 30 minutes. Turning it on for another business revokes the previous
  one.
- Every change re-checks, on the server: Super Admin role, a valid session,
  an active (not expired, not revoked) grant for this session and this
  business, and the existing permission (`operators.edit` or `users.manage`).
- Grants end on: **Turn off edit mode**, **Exit to back office**, expiry,
  signing out, or the session being revoked (the row is deleted with it).
- The audit log records access and changes; it is never used to authorise.

## What can be changed

- Business details shown to the client: name, category, website, booking
  page, primary contact, contact email and phone.
- Team (this business's operator users only): resend invitation, send a
  password-reset link, suspend or reactivate. No passwords are ever shown or
  set.
- Account status, features, programme and billing stay on the back-office
  business page.

## Audit entries (Back office → Audit log)

| Action | When |
|---|---|
| `support.view` | Page viewed (once per page per 5 minutes) |
| `support.edit_start` / `support.edit_end` | Edit mode on / off |
| `update` (operator) | Business details changed, with `onBehalfOf` and the grant id |
| `support.team_action` | Team action, plus the usual user audit entry |
| `support.exit` | Left the client view |

## Database

One additive table, `SupportEditGrant` (migration
`20261017000000_support_edit_grant`), with row-level security enabled like
every other table. No existing table changes. If the release is rolled back,
the table is simply unused.

## Revoking access quickly

- Sign the Super Admin out (Account → Sessions, or Users & access → Sign out
  everywhere): their grants are deleted with their sessions.
- Grants expire on their own after 30 minutes.
