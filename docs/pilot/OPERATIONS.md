# Running the Findable pilot

Pilot model: a **staff-led AI-visibility programme** for up to 10 Rotorua
tourism businesses, delivered through the Findable portal.

The Findable team checks how AI assistants describe each business, prepares
a plan, and shares weekly briefs. Findable does **not** run automated AI
checks yet.

## Before the first invitation (gate)

All of these must be true:
- [ ] Every P0 fix is released and verified in Production (see the release plan).
- [ ] Email works end to end (`docs/pilot/EMAIL-DELIVERY.md`, steps 1–9):
  - [ ] `theoutsidein.nz` shows **Verified** in Resend → Domains.
  - [ ] A Sending-access key is in `RESEND_API_KEY` (Production), and `EMAIL_FROM` uses the verified domain.
  - [ ] `APP_URL` = `https://app.theoutsidein.nz` (Production) and that address opens the app.
  - [ ] Back office → Users → **Send a test email to me** is accepted, and the email arrives (not in spam).
  - [ ] A test invitation and a password reset to an address we control work, and the links start with `https://app.theoutsidein.nz/`.
- [ ] Privacy policy and pilot terms are approved and published (`/privacy`, `/terms`).
- [ ] A support address is monitored and `SUPPORT_EMAIL` is set.
- [ ] Backups are confirmed and one restore test is done (`docs/runbooks/BACKUP-AND-RESTORE.md`).
- [ ] A second Super Admin account exists.

## Onboarding one business (about 1–2 hours of staff time)

1. **Agree terms:** send the pilot terms and get acceptance in writing.
2. **Create the business:** Cohort & operators → New operator. Record a contact, website and booking URL. Check that **Growth Collective is off** (the default for Findable after the readiness release; before it, turn it off on the business page).
3. **Data agreement:** record consents on the business page:
   - shared learnings;
   - anonymised totals;
   - case study.
   Leave them off unless agreed.
4. **Baseline AI review** (staff): ask several AI assistants the questions a visitor would ask (e.g. "best family activities in Rotorua", "where to stay near the lakes"). Record:
   - whether the business is mentioned;
   - how it's described;
   - what's wrong or missing.
   Save the findings as an assessment and as opportunities. Label them as observations on a date, not guarantees. Record a baseline measurement (e.g. "mentioned in 2 of 10 questions", evidence *Observed*).
5. **Prepare the plan.** New items start **staff only**. When the plan is ready, use **Show to client** on each item the business should see.
6. **Invite the people.** Back office → Users → Invite, role Tourism Operator, linked to this business. If the email can't be sent, you'll get a single-use link to pass on (after the hardening release; before it, only when email isn't configured).
7. **Welcome call (30 min):**
   - walk through the portal on the client's own device;
   - agree a contact person and the weekly rhythm;
   - explain that findings are observations of AI assistants at a point in time.
8. **Check activation:** within 3 days the invited user should show **Active**. If not, resend the invitation (Back office → Users).

## Weekly rhythm (about 1–1.5 hours per business)

- **Mon:** review updates the business sent (portal "Send update") and anything new. Re-check 2–3 AI questions if relevant.
- **Tue:**
  - generate the weekly brief (business → Intelligence → Generate draft). It only uses items the client can already see;
  - edit "why it matters" and the learnings;
  - set to **Shared**, which needs a second person's check if possible.
- **Thu:** follow up on open actions and mark them done when the business completes them.
- **Fri:** run `audit/pilot-metrics.sql` and note anything stalled.

## Support

| Channel | Who | Target |
|---|---|---|
| Support email (`SUPPORT_EMAIL`) | Owner | Reply within 1 business day |
| Portal "Send update" | Business → staff | Reviewed on Mondays |
| Security reports (SECURITY.md contact) | Anyone | Acknowledge within 5 business days |

### Common issues and fixes

| Issue | What to do |
|---|---|
| Invitation email didn't arrive | Back office → Users → person → **Resend invitation** (earlier links stop working). If sending fails you get a link to pass on (after the hardening release) |
| Invitation link expired | Same: resend. Links last 7 days |
| Forgot password | They use "Forgot password?" on the sign-in page. Links last 1 hour. Or Back office → Users → **Send reset link** |
| Locked out after failed sign-ins | Wait 15 minutes, then sign in or reset the password |
| Sees the wrong business / needs a second business | Back office → Users → person → link or unlink business |
| "My plan is empty" | Nothing has been shown yet. Use **Show to client** on the business page |
| Someone left the business | Back office → Users → **Suspend** (signs them out everywhere) |
| Need to see what they see | Back office → Clients → **View as client** (read-only; after the client-view release) |

## Feedback

- **Week 2:** a 10-minute check-in. What's useful? What's confusing?
- **Week 6:** short survey:
  - usefulness (1–5);
  - clarity of briefs (1–5);
  - likelihood to recommend (0–10);
  - one thing to change.
- **End of pilot:** a 30-minute interview, a decision to continue, and permission (or not) for a case study.

Record feedback against the business (Intelligence → signal, staff only) so it shapes the plan.

## Success measures

| Measure | Definition | Target for the pilot | Source |
|---|---|---|---|
| Activation | Invited client users who set a password within 7 days | ≥ 80% | `pilot-metrics.sql` (`client_users_activated`) |
| Engagement | Businesses with a client sign-in in the last 7 days | ≥ 60% weekly | `client_sign_ins_7d`, `last_client_sign_in` |
| Delivery | Weekly briefs shared on time | ≥ 90% of business-weeks | `briefs_shared`, `last_brief_week` |
| Action completion | Client-visible actions marked done | ≥ 50% by pilot end | `client_actions_done / client_actions` |
| Two-way use | Updates sent by the business | ≥ 1 per business per month | `updates_from_client` |
| AI visibility outcome | Change in the share of tested AI questions that mention the business (staff-run, same questions) | Improvement for ≥ 50% of businesses | Baseline vs. latest measurement (*Observed*) |
| Perceived value | Week-6 and end surveys | Usefulness ≥ 4/5; recommend ≥ 8/10 | Feedback notes |

## After the pilot

Decide from real use. Candidates:
- automated AI-visibility checks;
- email notifications when a brief is shared;
- a pilot-health dashboard;
- self-service team invites;
- billing integration.
