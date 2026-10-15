// End-to-end check of critical workflows and safety gates against a running
// app seeded with SEED_DEMO=true and the demo passwords from docs/GROWTH_OS.md.
// Usage: E2E_BASE_URL=http://localhost:3000 node tests/e2e/workflows.e2e.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const B = process.env.E2E_BASE_URL || "http://localhost:3000";
const T = 90000;
let pass = 0, fail = 0;
let lastPage; const check = async (name, ok, extra = "") => { if (!ok && lastPage) extra += " | page says: " + (await lastPage.locator('[aria-live="polite"]').allInnerTexts().catch(()=>[])).filter(Boolean).join(" / "); _check(name, ok, extra); };
const _check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };
async function login(b, email, pw) {
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(T);
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", pw);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click("button[type=submit]")]);
  return p;
}
const seen = (loc) => loc.first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
const status = (p) => p.locator('[aria-live="polite"]').filter({ hasText: /\S/ }).first();
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const stamp = Date.now().toString().slice(-6);

  // Bad login
  const p0 = await (await b.newContext()).newPage();
  await p0.goto(B + "/login"); await p0.fill("#email", "admin@demo.example"); await p0.fill("#password", "wrong-password-xx"); await p0.click("button[type=submit]");
  await check("wrong password shows error", await seen(p0.getByRole("alert").filter({ hasText: "incorrect" })));

  const p = await login(b, "admin@demo.example", "demo-pass-12345"); lastPage = p;
  // Admin cannot reach commercial or users
  await p.goto(B + "/commercial"); await check("admin redirected away from commercial", new URL(p.url()).pathname === "/no-access");
  await p.goto(B + "/settings/users"); await check("admin redirected away from users", new URL(p.url()).pathname === "/no-access");
  await p.goto(B + "/admin/billing"); await check("admin redirected away from billing", new URL(p.url()).pathname === "/no-access");
  const r = await p.request.get(B + "/api/export?entity=deals"); await check("admin export of deals forbidden", r.status() === 403);

  // Create operator
  await p.goto(B + "/operators/new");
  await p.fill("#f-name", `E2E Tours ${stamp}`); await p.selectOption("#f-category", "activity");
  await p.fill("#f-websiteUrl", "not-a-url");
  await p.click("button:has-text('Create operator')");
  await check("invalid URL blocked by browser validation", await p.locator("#f-websiteUrl:invalid").count() === 1);
  await p.fill("#f-websiteUrl", "https://e2e.example");
  await Promise.all([p.waitForURL(/\/operators\/c/), p.click("button:has-text('Create operator')")]);
  const opUrl = p.url(); await check("operator created", /\/operators\/c/.test(opUrl));

  // Consent gate: record signal with COHORT visibility without consent
  await p.goto(opUrl + "/intelligence");
  await p.click("summary:has-text('Record a signal')");
  await p.fill("#f-title", "Test signal"); await p.fill("#f-summary", "Summary"); await p.fill("#f-source", "E2E");
  await p.selectOption("#f-visibility", "COHORT");
  await p.click("button:has-text('Record signal')");
  await check("cohort sharing blocked without consent", await seen(status(p).filter({ hasText: /not consented/ })));
  await p.selectOption("#f-visibility", "CONFIDENTIAL");
  await p.click("button:has-text('Record signal')");
  await check("confidential signal recorded", await seen(status(p).filter({ hasText: /Signal recorded/ })));
  await p.click("button:has-text('Generate draft brief')");
  await p.waitForTimeout(1500); await p.reload();
  await check("draft brief generated", await seen(p.getByText("Scan — what changed")));

  // Assessment
  await p.goto(opUrl);
  await Promise.all([p.waitForURL(/\/assessments\//), p.click("button:has-text('Start assessment')")]);
  await p.selectOption("#f-status", "COMPLETE");
  await p.click("button:has-text('Save assessment')");
  await check("cannot complete unscored assessment", await seen(status(p).filter({ hasText: /Score every area/ })));
  for (const sel of await p.locator("select[name$='.score']").all()) await sel.selectOption("3");
  await p.click("button:has-text('Save assessment')");
  await check("assessment completed", await seen(status(p).filter({ hasText: /saved/i })));

  // Opportunity -> project -> task
  await p.click("a:has-text('Record opportunity')");
  await p.fill("#f-title", `E2E opp ${stamp}`); await p.selectOption("#f-area", "ENQUIRIES_CONVERSION"); await p.selectOption("#f-solutionType", "AUTOMATION");
  await p.fill("#f-problem", "Slow replies"); await p.fill("#f-proposedSolution", "Auto ack");
  await Promise.all([p.waitForURL(/\/opportunities\/c/), p.click("button:has-text('Create opportunity')")]);
  await check("opportunity created", /\/opportunities\/c/.test(p.url()));
  await Promise.all([p.waitForURL(/\/work\/projects\//), p.click("button:has-text('Convert to project')")]);
  await check("converted to project", /\/work\/projects\//.test(p.url()));
  await p.click("summary:has-text('Add task')");
  await p.fill("#f-title", `E2E task ${stamp}`);
  await p.click("button:has-text('Add task')");
  await status(p).filter({ hasText: /Task added/ }).waitFor({ timeout: T });
  await p.reload();
  await check("task visible on project", await p.getByText(`E2E task ${stamp}`).isVisible());

  // Measurement + experiment gate
  await p.goto(B + "/results");
  await p.locator("form").filter({ hasText: "Record" }).first();
  await p.selectOption("#f-operatorId >> nth=0", { label: `E2E Tours ${stamp}` }).catch(() => {});
  const form = p.locator("form", { has: p.locator("button:has-text('Record')") });
  await form.locator("[name=operatorId]").selectOption({ label: `E2E Tours ${stamp}` });
  await form.locator("[name=metric]").selectOption("QUALIFIED_ENQUIRIES");
  await form.locator("[name=value]").fill("40"); await form.locator("[name=unit]").fill("per month");
  await form.locator("[name=periodStart]").fill("2026-09-01"); await form.locator("[name=periodEnd]").fill("2026-09-30");
  await form.locator("[name=source]").fill("Operator estimate");
  await form.locator("button:has-text('Record')").click();
  await check("baseline measurement recorded", await seen(form.locator('[aria-live="polite"]').filter({ hasText: /recorded/ })));

  await p.goto(B + "/experiments/new");
  await p.fill("#f-title", `E2E exp ${stamp}`); await p.selectOption("#f-operatorId", { label: `E2E Tours ${stamp}` });
  await p.fill("#f-hypothesis", "H"); await p.fill("#f-problem", "P"); await p.fill("#f-intervention", "I");
  await p.selectOption("#f-primaryMetric", "QUALIFIED_ENQUIRIES"); await p.selectOption("#f-status", "RUNNING");
  await p.click("button:has-text('Create experiment')");
  await check("running experiment needs pre-set threshold", await seen(status(p).filter({ hasText: /target or minimum/ })));
  await p.fill("#f-baselineValue", "40"); await p.fill("#f-minimumAcceptable", "44"); await p.fill("#f-targetValue", "50");
  await Promise.all([p.waitForURL(/\/experiments\/c/), p.click("button:has-text('Create experiment')")]);
  await check("experiment created", /\/experiments\/c/.test(p.url()));

  // Library status gate
  await p.goto(B + "/library/new");
  await p.fill("#f-name", `E2E prompt ${stamp}`); await p.selectOption("#f-status", "OPERATIONAL"); await p.fill("#f-purpose", "x"); await p.fill("#f-instructions", "do x");
  await p.click("button:has-text('Create')");
  await check("cannot mark untested workflow operational", await seen(status(p).filter({ hasText: /test results/ })));

  // Founder: deal stage rule + export
  const f = await login(b, "founder@outsidein.example", "founder-demo-pass-1"); lastPage = f;
  await f.goto(B + "/commercial");
  await f.fill("#f-title", `E2E deal ${stamp}`); await f.fill("#f-organisation", "Org"); await f.selectOption("#f-type", "IMPLEMENTATION"); await f.selectOption("#f-stage", "CONTRACTED"); await f.fill("#f-oneOffValueNzd", "3000");
  await f.click("button:has-text('Add deal')");
  await check("contracted needs signature date", await seen(status(f).filter({ hasText: /signature date/ })));
  const ex = await f.request.get(B + "/api/export?entity=all");
  const body = await ex.text();
  await check("full export works and excludes password hashes", ex.status() === 200 && body.includes('"operators"') && !body.includes("passwordHash") && !body.includes("scrypt$"));
  const md = await f.request.get(B + "/api/reports?type=cohort");
  await check("cohort report downloads as markdown", md.status() === 200 && (await md.text()).startsWith("# Tourism AI Growth Collective"));

  // Super admin console: dashboard, invite with a one-time link (no email configured locally)
  await f.goto(B + "/admin");
  await check("super admin dashboard shows account totals", await seen(f.getByText("Active businesses")));
  await f.goto(B + "/admin/users");
  const inviteEmail = `e2e-invite-${stamp}@demo.example`;
  await f.fill("#f-name", "E2E Invitee"); await f.fill("#f-email", inviteEmail); await f.selectOption("#f-role", "OPERATOR");
  await f.selectOption("#f-businessIds", { index: 0 });
  await f.click("button:has-text('Send invitation')");
  const linkBox = f.locator("#one-time-link");
  await check("invitation produces a single-use link when email is off", await seen(linkBox));
  const inviteUrl = new URL(await linkBox.inputValue());
  const inv = await (await b.newContext()).newPage(); inv.setDefaultTimeout(T);
  await inv.goto(B + inviteUrl.pathname + inviteUrl.search);
  await inv.fill("#password", "invited-user-pass-1"); await inv.fill("#confirm", "invited-user-pass-1");
  await Promise.all([inv.waitForURL(/login\?invite=done/), inv.click("button:has-text('Activate account')")]);
  await check("invited user activates their account", /invite=done/.test(inv.url()));
  await inv.goto(B + inviteUrl.pathname + inviteUrl.search);
  await check("invitation link works only once", await seen(inv.getByText("This invitation isn't valid")));
  const iu = await login(b, inviteEmail, "invited-user-pass-1");
  await check("invited operator lands in the portal", new URL(iu.url()).pathname === "/portal");
  await iu.goto(B + "/admin"); await check("operator cannot open the admin console", new URL(iu.url()).pathname === "/portal");
  await iu.goto(B + "/portal/account");
  await check("operator can manage their own account", await seen(iu.getByText("Where you're signed in")));
  // Suspend the invited user (requires the confirmation box)
  await f.goto(B + "/admin/users?q=" + encodeURIComponent(inviteEmail));
  await f.click(`a:has-text("E2E Invitee")`);
  const statusForm = f.locator("form", { has: f.locator("button:has-text('Change status')") });
  await statusForm.locator("select[name=status]").selectOption("SUSPENDED");
  await statusForm.locator("input[name=confirm]").check();
  await statusForm.locator("button:has-text('Change status')").click();
  await check("super admin can suspend a user", await seen(f.getByText(/is now suspended/)));
  await iu.goto(B + "/portal"); await check("suspended user is signed out immediately", /login/.test(iu.url()));
  // Forgot password never reveals whether an account exists
  const fp = await (await b.newContext()).newPage();
  await fp.goto(B + "/forgot-password"); await fp.fill("#email", `nobody-${stamp}@demo.example`); await fp.click("button:has-text('Send reset link')");
  await check("forgot password gives a generic answer", await seen(fp.getByRole("status").filter({ hasText: "If an account exists" })));

  // Operator cannot download exports/reports
  const o = await login(b, "operator1@demo.example", "demo-pass-12345"); lastPage = o;
  await check("operator export forbidden", (await o.request.get(B + "/api/export?entity=all")).status() === 403);
  await check("operator report forbidden", (await o.request.get(B + "/api/reports?type=founder")).status() === 403);
  await o.goto(B + "/portal");
  await o.fill("#f-title", "Lots of rain cancellations"); await o.fill("#f-summary", "Three cancellations"); await o.click("button:has-text('Send update')");
  await check("operator can submit an update", await seen(status(o).filter({ hasText: /Thanks/ })));
  // Logout revokes session
  await o.click("button:has-text('Sign out')"); await o.waitForURL(/login/);
  await o.goto(B + "/portal"); await check("signed-out user redirected to login", /login/.test(o.url()));

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
