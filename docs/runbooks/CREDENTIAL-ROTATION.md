# Credential rotation

Rotate when:
- a credential may have leaked (chat, email, screenshot, repo, laptop loss);
- someone with access leaves;
- once a year.

Never paste a credential into chat, a ticket or the repository.

| Credential | Where it lives | How to rotate | Effect | Check afterwards |
|---|---|---|---|---|
| Database password (`DATABASE_URL`, `DIRECT_URL`) | Supabase; Vercel env (Production) | Supabase → Project Settings → Database → **Reset database password** → update both Vercel variables (Sensitive) → **Redeploy** | Brief errors between reset and redeploy (plan for a quiet time) | Sign in; Vercel runtime errors empty |
| `RESEND_API_KEY` | Resend; Vercel env | Resend → API Keys → create new (sending only) → update Vercel → Redeploy → delete old key | None if done in that order | Send yourself a password reset |
| `SETUP_TOKEN` | Vercel env | Not needed after the first Super Admin exists: **delete it** (Production and Development) | None (setup page is closed once users exist) | `/setup` shows nothing to do |
| `ANTHROPIC_API_KEY` (if AI tools are enabled) | Anthropic Console; Vercel env | Create new key → update Vercel → Redeploy → revoke old | None | Run one staff analysis |
| Vercel account / tokens | Vercel | Account → Tokens → revoke unused; enable 2FA | None | – |
| GitHub access | GitHub | Settings → Applications / tokens → revoke unused; enable 2FA | None | – |
| Supabase account | Supabase | Enable MFA; remove unused members | None | – |
| Freeparking (DNS) | Freeparking | Change password; enable 2FA if offered | None | – |
| A Findable user's sessions | Findable | Back office → Users → user → **Sign out everywhere** (or Suspend) | User signs in again | – |

## Order of operations for a suspected leak

1. Rotate the leaked credential first (table above).
2. Check for misuse:
   - Supabase logs;
   - the Findable audit log;
   - Resend sending logs;
   - Vercel deployments and env change history.
3. Record it in the incident log (`INCIDENT-RESPONSE.md`).
