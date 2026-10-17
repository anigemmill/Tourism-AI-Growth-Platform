# Account email: setup and verification

Findable sends three account emails, all through Resend's HTTP API (`src/lib/email.ts`):

| Email | Triggered by | Link | Link valid for |
|---|---|---|---|
| Invitation | Back office → Users → Invite, or **Resend invitation** | `APP_URL/invite?token=…` | 7 days |
| Password reset | `/forgot-password` (self-service), or Back office → user → **Send password reset** | `APP_URL/reset-password?token=…` | 1 hour |
| Email verification | My account → verify email | `APP_URL/verify-email?token=…` | 2 days |

There are no other outgoing emails: no notifications, digests or marketing mail.

Each link works once. Nobody else, including staff, can see or set someone's password.

## Settings

All three are Vercel environment variables. Each one needs to be set for every environment that should send email.

| Variable | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | A Resend API key with **Sending access** | Secret. Store it as Sensitive. Never paste it anywhere else. |
| `EMAIL_FROM` | `Findable <no-reply@theoutsidein.nz>` | The domain must be **Verified** in Resend → Domains. |
| `APP_URL` | `https://app.theoutsidein.nz` | **Required in Production.** It must be the base address only: https, with no path. |

If `APP_URL` is missing or invalid in Production, the app issues **no** invitation or reset link at all. Without it, Vercel falls back to the project's shortest production domain, `theoutsidein.nz`. That domain serves the main website, so the links would break, and the single-use token would be sent to the website's host.

## Checking it yourself

**Back office → Users → Account email** is visible to super admins only. It shows:
- whether the key and sender are set;
- the sender address;
- where links point.

It also has **Send a test email to me**. The test email:
- goes only to your own address;
- contains no link;
- is limited to 5 per hour;
- is recorded in the audit log.

If Resend refuses the email, the card shows Resend's error code and what to do about it. The same code appears in the Vercel runtime log as `email send failed: HTTP <status> resend=<code> failure=<class> from-domain=<domain>`.

| `failure` | Meaning | Fix |
|---|---|---|
| `api_key` | The key is invalid, revoked, missing or doesn't allow sending | Create a new key with Sending access and replace `RESEND_API_KEY` |
| `sender_not_verified` | The domain in `EMAIL_FROM` isn't verified | Finish domain verification in Resend, or use a verified domain |
| `testing_mode` | The Resend account has no verified domain, so it delivers only to the account owner | Verify the domain |
| `invalid_sender` | `EMAIL_FROM` is malformed | Use `Findable <no-reply@your-domain>` |
| `rate_limited` | A rate limit or quota was reached | Wait; check the plan's limits |
| `rejected` | Any other refusal (for example a bad recipient) | Resend → Logs |
| `unavailable` | Network error, timeout or a Resend outage | Retry; check status.resend.com |

## Launch checklist: email

Owner actions are marked **(owner)**. Each one needs your access or approval.

1. **Resend: domain (owner).** In Resend → Domains, `theoutsidein.nz` must show **Verified**.
   - If it isn't there, click **Add domain**.
   - Resend lists the DNS records it needs:
     - a DKIM TXT record on `resend._domainkey`;
     - an MX record and an SPF TXT record on the `send` subdomain;
     - optionally a DMARC record.
   - Add exactly those records at Freeparking. They sit on subdomains only. Don't change the root or `www` A records, or the root MX and SPF records that the existing mailbox uses.
2. **Resend: key (owner).** In Resend → API Keys, create a key:
   - name `findable-production`;
   - permission **Sending access**;
   - domain `theoutsidein.nz`.

   Copy it straight into Vercel (next step). Delete the old key once the new one works.
3. **Vercel: variables (owner).** Project → Settings → Environment Variables, environment **Production**:
   - edit `RESEND_API_KEY` (paste the new key) and keep it Sensitive;
   - check that `EMAIL_FROM` is `Findable <no-reply@theoutsidein.nz>`;
   - add `APP_URL` = `https://app.theoutsidein.nz` once the app domain is live (domain stage D1–D3).

   Variables apply only to new deployments, so redeploy after changing them.
4. **Release (approval).** Merge the email branch, then redeploy.
5. **Email check.** Back office → Users → **Send a test email to me**. Expect "Resend accepted…". Then confirm the message arrives in your inbox and not in spam.
6. **Invitation test.** Invite a test address you control, not a pilot customer. Then:
   - open the link and check it starts with `https://app.theoutsidein.nz/invite?token=`;
   - set a password and sign in;
   - open the same link again and confirm it's refused.
7. **Password reset test.** For that test account:
   - request a reset at `/forgot-password`;
   - open the link (expect `https://app.theoutsidein.nz/reset-password?token=`) and set a new password;
   - confirm the old password no longer works, the link can't be reused, and other sessions were signed out;
   - request a reset for an unknown address and confirm the page shows the same message.
8. **Failure handling.** Look at the Vercel log line for any failed send. A super admin who invites someone while sending fails gets a single-use link to pass on in person, after the hardening release.
9. **Tidy up.** Revoke the test account's invitation, or archive the account. Delete the old Resend key.
