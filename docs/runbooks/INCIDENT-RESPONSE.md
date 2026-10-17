# Incident response (pilot)

For anything that affects clients' data, access or trust: a security report,
data shown to the wrong business, an outage, lost data, or a leaked
credential.

## 1. First 30 minutes

1. **Open an incident note** (date, who noticed, what was seen) in the pilot
   log. Keep times in NZ time.
2. **Contain without destroying evidence.** Pick the smallest action that
   stops harm:
   - a wrong person has access → Back office → Users → **Suspend** (signs
     them out everywhere);
   - a business's data is exposed → Back office → Businesses → **Suspend**
     the business, or roll back the release (Vercel → Deployments → Instant
     Rollback) if a release caused it;
   - a credential leaked → rotate it now (`CREDENTIAL-ROTATION.md`).
3. **Preserve evidence:**
   - export the audit log (*Data export → audit log*);
   - note the deployment id from Vercel;
   - screenshot what the client saw.
   - Vercel runtime logs are short-lived (1 hour on Hobby, 1 day on Pro), so
     copy relevant log lines immediately.

## 2. Assess (same day)

- **What data, which businesses and people, since when?** Use the audit log
  (who did what, when) and the read-only audit queries in
  `docs/pilot/audit/`.
- **Is it a personal-information breach likely to cause serious harm?** If
  so, the Privacy Act 2020 requires notifying the Office of the Privacy
  Commissioner and the affected people **as soon as practicable**. Use the
  OPC's NotifyUs tool. If unsure, take advice the same day.

## 3. Fix and verify

- Fix on a branch with a regression test, review, then release with the
  usual approval.
- Re-run the relevant audit query to confirm the condition is gone.
- Restore access that was suspended for containment.

## 4. Tell people

| Who | When | What |
|---|---|---|
| Affected clients | Same or next business day once facts are clear | What happened, what data, what you've done, what they should do |
| Reporter (security reports) | Acknowledge within 5 business days (SECURITY.md target), sooner if possible | Thanks, status, and when it's fixed |
| Privacy Commissioner | If a notifiable breach | Via NotifyUs |

## 5. Close

Write a short review in the pilot log:
- timeline;
- cause;
- impact;
- fix;
- what will prevent it recurring.

Link the fix commit.

## Contacts and access needed

| Role | Tool access |
|---|---|
| Owner (Super Admin) | Findable Back office, Vercel, Supabase, Resend, GitHub, Freeparking DNS |
| Second Super Admin (recommended) | Findable Back office, so one person's absence can't block containment |
