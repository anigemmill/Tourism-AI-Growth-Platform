# Proposed protection for `main`

**Status: proposal, not applied.** Applying it changes a GitHub repository
setting and needs the owner's explicit approval.

The repository is public, so GitHub rulesets are available on the free plan.

## Why

Vercel deploys `main` to Production on every push, and the build applies
database migrations. Today anyone with write access (or a leaked token) can
push straight to `main`, force-push over its history or delete it, and
nothing requires CI or the secret scan to pass first.

## Proposed ruleset

GitHub → repository **Settings → Rules → Rulesets → New branch ruleset**.

| Setting | Value | Reason |
|---|---|---|
| Name | `Protect main` | |
| Enforcement status | **Active** (or **Evaluate** first to see what it would block) | |
| Bypass list | Empty. Optionally the repository admin, "for pull requests only" | No silent direct pushes |
| Target branches | Default branch | |
| Restrict deletions | On | `main` can't be deleted |
| Block force pushes | On | History can't be rewritten |
| Require a pull request before merging | On, **0** required approvals | Every change goes through a PR so checks run first. With one maintainer, a required approval would block every merge (you can't approve your own PR); raise it to 1 when a second reviewer joins |
| Dismiss stale approvals on push | On | |
| Require conversation resolution | On | |
| Require status checks to pass | On, "require branches to be up to date" on | |
| Required checks | `check` (CI) and `gitleaks` (Secret scan) | Lint, types, tests, build and secret scan must be green |
| Require linear history | **Off** | Releases use normal merge commits |
| Require signed commits | Off for now | Revisit once signing keys are set up |

The same as JSON, for **Rulesets → Import a ruleset** (or the REST API
`POST /repos/anigemmill/Tourism-AI-Growth-Platform/rulesets`):

```json
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "check" },
          { "context": "gitleaks" }
        ]
      }
    }
  ]
}
```

## Before turning it on

1. Merge the security branch first, so the `gitleaks` check exists on
   `main`. A required check that never runs blocks every PR.
2. Check both checks have passed at least once on a PR.

## Effect on day-to-day work

- **Uploading files in the GitHub web UI straight to `main` stops working.**
  The web UI offers "Create a new branch and start a pull request" instead;
  merge the PR once checks pass.
- Releases (for example the client view) go through a PR and a merge commit,
  not a fast-forward push.
- Vercel is unaffected: it still deploys whatever lands on `main`, and still
  builds previews for branches.
- In an emergency the owner can set the ruleset to **Disabled**, push, and
  re-enable it. That action is recorded in the repository's audit log.

## Related settings to switch on (free for public repositories)

These are repository settings and also need approval:

- **Secret Protection: secret scanning and push protection**
  (Settings → Advanced Security). GitHub scans for known token formats and
  blocks pushes that contain them.
- **Private vulnerability reporting** (same page). This lets researchers
  report privately through the repository's Security tab.
- **Dependabot alerts**.
