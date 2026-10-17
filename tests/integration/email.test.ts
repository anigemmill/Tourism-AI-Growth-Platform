// Account email: links are only issued for an explicit, safe APP_URL in
// production, point at it when set, and the super-admin email check reports
// Resend failures without sending anything to anyone but the admin.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.EMAIL_DEV_LOG = "off";

import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth/password";
import { devOutbox } from "../../src/lib/email";
import * as admin from "../../src/lib/admin/users";
import { sendTestEmail } from "../../src/lib/admin/email-check";
import { effectivePermissions } from "../../src/lib/rbac/permissions";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
const mail = (n: string) => `${n}-${tag}@email-test.example`;
let A: string;
let superId: string;
const superActor = (): admin.AdminActor => ({ id: superId, name: "Super", role: "FOUNDER", permissions: effectivePermissions("FOUNDER") });

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  const set = (v: Record<string, string | undefined>) => {
    for (const [k, val] of Object.entries(v)) if (val === undefined) delete process.env[k]; else process.env[k] = val;
  };
  set(vars);
  try {
    return await fn();
  } finally {
    set(saved);
  }
}

before(async () => {
  A = (await prisma.operator.create({ data: { name: `Email Biz ${tag}`, category: "activity" } })).id;
  superId = (await prisma.user.create({ data: { email: mail("super"), name: "Super", role: "FOUNDER", passwordHash: await hashPassword("correct-horse-battery") } })).id;
});

after(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: tag } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { email: { contains: tag } } });
  await prisma.operator.deleteMany({ where: { id: A } });
  await prisma.$disconnect();
});

test("production without APP_URL issues no invitation link at all (it would point at the main website)", async () => {
  await withEnv({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "theoutsidein.nz", APP_URL: undefined }, async () => {
    const before = devOutbox.length;
    const r = await admin.inviteUser(superActor(), { name: "No Base", email: mail("nobase"), role: "OPERATOR", businessIds: [A] });
    assert.ok(r.ok);
    assert.equal(r.ok && r.delivery?.emailed, false);
    assert.equal(r.ok && r.delivery?.manualLink, undefined, "no hand-over link either");
    assert.equal(devOutbox.length, before, "nothing sent");
    const u = await prisma.user.findUniqueOrThrow({ where: { email: mail("nobase") } });
    assert.equal(await prisma.authToken.count({ where: { userId: u.id } }), 0, "no token issued");
  });
});

test("with APP_URL set, invitation and password-reset links use it", async () => {
  await withEnv({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "theoutsidein.nz", APP_URL: "https://app.theoutsidein.nz/" }, async () => {
    const r = await admin.inviteUser(superActor(), { name: "With Base", email: mail("withbase"), role: "OPERATOR", businessIds: [A] });
    assert.ok(r.ok);
    // Email isn't configured in tests, so the super admin gets the link to hand over.
    assert.match(r.ok ? r.delivery?.manualLink ?? "" : "", /^https:\/\/app\.theoutsidein\.nz\/invite\?token=[^&\s]+$/);

    const u = await prisma.user.update({ where: { email: mail("withbase") }, data: { status: "ACTIVE", passwordHash: await hashPassword("correct-horse-battery") } });
    const reset = await admin.sendPasswordReset(superActor(), u.id);
    assert.ok(reset.ok);
    assert.match(reset.ok ? reset.delivery?.manualLink ?? "" : "", /^https:\/\/app\.theoutsidein\.nz\/reset-password\?token=/);
  });
});

test("email check: super admin only, refuses when unconfigured", async () => {
  const staff = { id: superId, email: mail("super"), role: "ADMIN" };
  assert.deepEqual(await sendTestEmail(staff), { ok: false, error: "Only a super admin can run the email check." });
  await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, async () => {
    const r = await sendTestEmail({ id: superId, email: mail("super"), role: "FOUNDER" });
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : "", /isn't configured/);
  });
});

test("email check sends only to the admin, names Resend's error and audits the outcome", async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const calls: { url: string; body: { to: string[]; text: string } }[] = [];
  console.error = () => {};
  try {
    await withEnv({ RESEND_API_KEY: "re_test_not_real", EMAIL_FROM: "Findable <no-reply@theoutsidein.nz>" }, async () => {
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ name: "validation_error", message: "The theoutsidein.nz domain is not verified. Please, add and verify your domain on https://resend.com/domains" }), { status: 403 });
      }) as typeof fetch;
      const r = await sendTestEmail({ id: superId, email: mail("super"), role: "FOUNDER" });
      assert.equal(r.ok, false);
      assert.match(!r.ok ? r.error : "", /Resend: validation_error, HTTP 403.*domain in EMAIL_FROM isn't verified/);

      globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      }) as typeof fetch;
      const ok = await sendTestEmail({ id: superId, email: mail("super"), role: "FOUNDER" });
      assert.ok(ok.ok);
    });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.deepEqual(c.body.to, [mail("super")], "only the admin's own address");
    assert.ok(!/https?:\/\//.test(c.body.text), "test email has no link");
  }
  const logs = await prisma.auditLog.findMany({ where: { actorId: superId, action: "email.test" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(logs.map((l) => (l.changes as { outcome: string }).outcome), ["sender_not_verified", "accepted"]);
});
