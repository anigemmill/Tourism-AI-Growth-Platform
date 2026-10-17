# Production read-only audits

The owner runs these in the Supabase SQL editor of the production project
(`hescoabpcjukmgeopjnq`, Sydney). Each file is one read-only `SELECT`. No
query reads password hashes, sessions or tokens.

| File | Purpose | SHA-256 |
|---|---|---|
| `audit/leftover-access-audit.sql` | Business links left behind by revoked or re-invited invitations; outstanding invitations; multi-business operators | `65c15c10…88910` |
| `audit/collective-dependency.sql` | Which businesses lose Growth Collective access when Findable's off-by-default is released, and how many client users notice | `810976c5…968d8` |
| `audit/shared-visibility-exposure.sql` | Whether the cross-business shared-visibility defect actually exposed records (counts only) | `1333693e…35251` |
| `audit/pilot-metrics.sql` | Weekly pilot success measures per real (non-demo) business | `a94551d0…cbcc39` |

Full checksums are in `audit/SHA256SUMS`. Verify them on your own computer:
- macOS / Linux: `shasum -a 256 -c SHA256SUMS`
- Windows (PowerShell): `Get-FileHash <file> -Algorithm SHA256`

## Steps

1. **Check the files.** Verify the checksums. Stop if any differs.
2. **Open the right project.**
   - Supabase → the project whose **Reference ID is `hescoabpcjukmgeopjnq`**: in the address bar and under Project Settings → General.
   - Region Sydney.
   - Open **SQL Editor** → new query.
3. **Optional confirmation:**
   ```sql
   SELECT migration_name, finished_at IS NOT NULL AS applied FROM "_prisma_migrations" ORDER BY started_at;
   ```
   Expect the migrations on `main`, all applied.
4. **Prove read-only.** Paste a file and type `EXPLAIN` on a new line directly above its first `WITH`/`SELECT`, then run. The plan must contain only reading steps (Scan, Join, Sort, Aggregate…), never `Insert`, `Update`, `Delete` or `ModifyTable`. Remove the `EXPLAIN` line.
5. **Run** each file in its own tab.
6. **Export** each result (CSV) or screenshot it. Emails are masked in the leftover-access audit; the others contain no personal data.

Any fix arising from a finding is a separate, approved action through the Back office (audited). There are no direct database writes.

## Interpreting results

| Query | Healthy | Action if not |
|---|---|---|
| Leftover access **A** | 0 rows | Unlink the business, or archive and re-invite correctly (approval per account) |
| Leftover access **B** | 0 rows | Confirm intent; unlink the old business if unintended (approval) |
| Leftover access **C / P** | any; confirm each | None if intended |
| Leftover access **D** | 0 rows | Cosmetic; fixes itself on next sign-in or business switch |
| Collective dependency | rows with `access_changes = true` and `active_client_users > 0` need a decision | Keep on: set Collective explicitly on for that business at release (approval) |
| Shared-visibility exposure | 0 rows, or rows with `other_businesses_with_users = 0` | If records were visible to other businesses: assess per `docs/runbooks/INCIDENT-RESPONSE.md` §2 (possible notification), then release the fix |
| Pilot metrics | – | Weekly review (see `OPERATIONS.md`) |
