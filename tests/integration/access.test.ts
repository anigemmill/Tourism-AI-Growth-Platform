// Integration tests against a real Postgres database. Run with
//   TEST_DATABASE_URL=postgresql://…/growthos_test npm run test:integration
// The suite refuses to run against a database whose name lacks "test".

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth/password";
import { attemptLogin, userForToken, revokeToken } from "../../src/lib/auth/core";
import { hashToken } from "../../src/lib/auth/tokens";
import * as portal from "../../src/lib/dal/portal";

// Prisma connects lazily, so this guard runs before any query.
if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
const PW = "correct-horse-battery";
let A: string, B: string, initiativeId: string, programmeId: string;
const emails = { a: `a-${tag}@test.example`, b: `b-${tag}@test.example`, staff: `s-${tag}@test.example`, unlinked: `u-${tag}@test.example`, inactive: `i-${tag}@test.example` };

before(async () => {
  const p = await prisma.programme.create({ data: { name: `Test ${tag}`, startDate: new Date(), active: false } });
  programmeId = p.id;
  A = (await prisma.operator.create({ data: { name: `Op A ${tag}`, category: "activity", status: "ACTIVE", programmeId, internalNotes: "SECRET-A-NOTE" } })).id;
  B = (await prisma.operator.create({ data: { name: `Op B ${tag}`, category: "accommodation", status: "ACTIVE", programmeId } })).id;
  const hash = await hashPassword(PW);
  await prisma.user.createMany({
    data: [
      { email: emails.a, name: "A user", role: "OPERATOR", operatorId: A, passwordHash: hash },
      { email: emails.b, name: "B user", role: "OPERATOR", operatorId: B, passwordHash: hash },
      { email: emails.staff, name: "Staff", role: "ADMIN", passwordHash: hash },
      { email: emails.unlinked, name: "Unlinked", role: "OPERATOR", passwordHash: hash },
      { email: emails.inactive, name: "Inactive", role: "ADMIN", passwordHash: hash, status: "ARCHIVED" },
    ],
  });
  const ids = Object.fromEntries((await prisma.user.findMany({ where: { email: { in: [emails.a, emails.b] } } })).map((u) => [u.email, u.id]));
  await prisma.userBusiness.createMany({ data: [{ userId: ids[emails.a], operatorId: A }, { userId: ids[emails.b], operatorId: B }] });
  const opp = (operatorId: string, title: string, visibility: "INTERNAL" | "CONFIDENTIAL" | "COHORT") =>
    prisma.opportunity.create({ data: { operatorId, title, visibility, area: "OPERATIONS", solutionType: "PROCESS_CHANGE", problem: "p", proposedSolution: "s" } });
  await opp(A, `A-conf-${tag}`, "CONFIDENTIAL");
  await opp(A, `A-internal-${tag}`, "INTERNAL");
  await opp(B, `B-conf-${tag}`, "CONFIDENTIAL");
  await prisma.task.createMany({ data: [{ title: `A-task-${tag}`, operatorId: A }, { title: `B-task-${tag}`, operatorId: B }, { title: `A-internal-task-${tag}`, operatorId: A, visibility: "INTERNAL" }] });
  await prisma.measurement.createMany({ data: [A, B].map((operatorId) => ({ operatorId, metric: "GUEST_NIGHTS" as const, kind: "BASELINE" as const, value: operatorId === A ? 111 : 222, unit: "n", periodStart: new Date(), periodEnd: new Date(), source: "t", recordedBy: "t" })) });
  await prisma.learning.createMany({
    data: [
      { title: `B-conf-learning-${tag}`, body: "x", operatorId: B, visibility: "CONFIDENTIAL", createdBy: "t" },
      { title: `cohort-learning-${tag}`, body: "x", visibility: "COHORT", createdBy: "t" },
      { title: `cultural-learning-${tag}`, body: "x", visibility: "COHORT", culturalReview: "REQUIRED", createdBy: "t" },
    ],
  });
  initiativeId = (await prisma.sharedInitiative.create({ data: { title: `Init ${tag}`, description: "d", initiativeType: "overnight-package", programmeId, participants: { create: [{ operatorId: A }, { operatorId: B }] } } })).id;
  await prisma.experiment.createMany({
    data: [
      { title: `B-exp-${tag}`, operatorId: B, hypothesis: "h", problem: "p", intervention: "i", primaryMetric: "GUEST_NIGHTS" },
      { title: `shared-exp-${tag}`, initiativeId, hypothesis: "h", problem: "p", intervention: "i", primaryMetric: "GUEST_NIGHTS" },
    ],
  });
  await prisma.growthBrief.createMany({
    data: [
      { operatorId: A, weekOf: new Date(), whatChanged: [], actions: [], generatedBy: "rules", createdBy: "t", status: "DRAFT" },
      { operatorId: A, weekOf: new Date(), whatChanged: [], actions: [], generatedBy: "rules", createdBy: "t", status: "SHARED" },
    ],
  });
});

after(async () => {
  await prisma.operator.deleteMany({ where: { id: { in: [A, B] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await prisma.sharedInitiative.deleteMany({ where: { id: initiativeId } });
  await prisma.learning.deleteMany({ where: { title: { contains: tag } } });
  await prisma.programme.deleteMany({ where: { id: programmeId } });
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: tag } } });
  await prisma.$disconnect();
});

const actorA = () => ({ id: "x", role: "OPERATOR" as const, operatorId: A });

test("operator A cannot read operator B's confidential records through the portal DAL", async () => {
  const opps = await portal.portalOpportunities(actorA());
  assert.deepEqual(opps.map((o) => o.title), [`A-conf-${tag}`]);
  const tasks = await portal.portalTasks(actorA());
  assert.deepEqual(tasks.map((t) => t.title), [`A-task-${tag}`]);
  const ms = await portal.portalMeasurements(actorA());
  assert.deepEqual(ms.map((m) => m.value), [111]);
  const learnings = (await portal.portalLearnings(actorA())).map((l) => l.title).filter((t) => t.includes(tag));
  assert.deepEqual(learnings, [`cohort-learning-${tag}`]);
  const exps = (await portal.portalExperiments(actorA())).map((e) => e.title).filter((t) => t.includes(tag));
  assert.deepEqual(exps, [`shared-exp-${tag}`]);
  const briefs = await portal.portalBriefs(actorA());
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].status, "SHARED");
});

test("portal business view never exposes internal staff notes", async () => {
  const biz = await portal.portalBusiness(actorA());
  assert.equal(biz.id, A);
  assert.ok(!("internalNotes" in biz));
  assert.ok(!JSON.stringify(biz).includes("SECRET-A-NOTE"));
});

test("portal DAL rejects non-operator and unlinked actors", async () => {
  await assert.rejects(portal.portalBusiness({ id: "s", role: "ADMIN", operatorId: null }));
  await assert.rejects(portal.portalOpportunities({ id: "u", role: "OPERATOR", operatorId: null }));
  const tasks = await portal.portalTasks({ id: "u", role: "OPERATOR", operatorId: null });
  assert.equal(tasks.length, 0);
});

test("initiative participants see the initiative; the directory exposes public fields only", async () => {
  const inits = await portal.portalInitiatives(actorA());
  assert.ok(inits.some((i) => i.id === initiativeId));
  const dir = await portal.portalDirectory(actorA());
  const b = dir.find((d) => d.id === B)!;
  assert.deepEqual(Object.keys(b).sort(), ["category", "id", "name", "websiteUrl"]);
});

test("other businesses' shared items reach a client only as far as their consent goes", async () => {
  const other = await prisma.programme.create({ data: { name: `Other ${tag}`, startDate: new Date(), active: false } });
  const C = (await prisma.operator.create({ data: { name: `Op C ${tag}`, category: "activity", status: "ACTIVE", programmeId: other.id } })).id;
  const D = (await prisma.operator.create({ data: { name: `Op D ${tag}`, category: "activity", status: "ACTIVE" } })).id;
  const exp = (operatorId: string, title: string, visibility: "COHORT" | "AGGREGATE_APPROVED" | "PUBLIC_APPROVED") =>
    ({ title, operatorId, visibility, hypothesis: "h", problem: "p", intervention: "i", primaryMetric: "GUEST_NIGHTS" as const });
  try {
    await prisma.experiment.createMany({
      data: [exp(B, `B-cohort-exp-${tag}`, "COHORT"), exp(B, `B-aggregate-exp-${tag}`, "AGGREGATE_APPROVED"), exp(C, `C-public-exp-${tag}`, "PUBLIC_APPROVED")],
    });
    await prisma.learning.createMany({
      data: [
        { title: `B-cohort-learning-${tag}`, body: "x", operatorId: B, visibility: "COHORT", createdBy: "t" },
        { title: `B-aggregate-learning-${tag}`, body: "x", operatorId: B, visibility: "AGGREGATE_APPROVED", createdBy: "t" },
        { title: `C-cohort-learning-${tag}`, body: "x", operatorId: C, visibility: "COHORT", createdBy: "t" },
        { title: `C-public-learning-${tag}`, body: "x", operatorId: C, visibility: "PUBLIC_APPROVED", createdBy: "t" },
      ],
    });
    const mine = (rows: { title: string }[]) => rows.map((r) => r.title).filter((t) => t.includes(tag)).sort();

    // The overview lists this business's own experiments and its initiatives, never other businesses'.
    assert.deepEqual(mine(await portal.portalExperiments(actorA())), [`shared-exp-${tag}`]);

    // Collective learnings: same-programme cohort sharing and public case studies only.
    // "Anonymised aggregate" consent never shows another business's item.
    assert.deepEqual(mine(await portal.portalLearnings(actorA())), [`B-cohort-learning-${tag}`, `C-public-learning-${tag}`, `cohort-learning-${tag}`].sort());
    // A business in another programme never sees this cohort's businesses' items.
    // (Staff-written cohort items have no owning business or programme, so they
    // reach any business that is in a programme.)
    const cLearnings = mine(await portal.portalLearnings({ id: "x", role: "OPERATOR", operatorId: C }));
    assert.ok(!cLearnings.includes(`B-cohort-learning-${tag}`));
    assert.ok(!cLearnings.includes(`B-aggregate-learning-${tag}`));
    // A business in no programme sees only public items from others.
    assert.deepEqual(mine(await portal.portalLearnings({ id: "x", role: "OPERATOR", operatorId: D })), [`C-public-learning-${tag}`]);
  } finally {
    await prisma.experiment.deleteMany({ where: { title: { contains: tag }, operatorId: { in: [B, C] } } });
    await prisma.learning.deleteMany({ where: { title: { contains: tag }, operatorId: { in: [B, C] } } });
    await prisma.operator.deleteMany({ where: { id: { in: [C, D] } } });
    await prisma.programme.deleteMany({ where: { id: other.id } });
  }
});

test("login: success creates a hashed server-side session; token resolves to the user", async () => {
  const r = await attemptLogin(emails.a.toUpperCase(), PW);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.user.operatorId, A);
  const stored = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(r.token) } });
  assert.ok(stored, "session stored by hash");
  assert.equal(await prisma.authSession.count({ where: { tokenHash: r.token } }), 0, "raw token never stored");
  assert.equal((await userForToken(r.token))?.id, r.user.id);
  await revokeToken(r.token);
  assert.equal(await userForToken(r.token), null);
});

test("login: wrong password, deactivated user and unknown email are refused with the same message", async () => {
  for (const [email, pw] of [[emails.b, "wrong-password-123"], [emails.inactive, PW], [emails.unlinked, "wrong-password-123"], [`nobody-${tag}@test.example`, PW]]) {
    const r = await attemptLogin(email, pw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "Email or password is incorrect.");
  }
});

test("login: an operator with no active business is refused (only after the right password)", async () => {
  const r = await attemptLogin(emails.unlinked, PW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /business account is not active/);
});

test("login: repeated failures lock the account temporarily", async () => {
  for (let i = 0; i < 8; i++) await attemptLogin(emails.staff, "nope-nope-nope");
  const r = await attemptLogin(emails.staff, PW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Too many failed attempts/);
});

test("expired sessions are rejected and removed", async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: emails.b } });
  const token = `expired-${tag}`;
  await prisma.authSession.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await userForToken(token), null);
  assert.equal(await prisma.authSession.count({ where: { tokenHash: hashToken(token) } }), 0);
});

test("portal team and billing views are scoped to the operator's own business", async () => {
  await prisma.invoice.create({ data: { operatorId: B, number: `B-INV-${tag}`, amountCents: 1000, issuedAt: new Date(), notes: "SECRET-B-BILLING-NOTE" } });
  await prisma.invoice.create({ data: { operatorId: A, number: `A-INV-${tag}`, amountCents: 2000, issuedAt: new Date(), notes: "SECRET-A-ADMIN-NOTE", providerRef: "prov_secret" } });
  try {
    const team = await portal.portalTeam(actorA());
    assert.deepEqual(team.map((m) => m.name), ["A user"]);
    assert.ok(!JSON.stringify(team).includes("@"), "team view exposes no email addresses or hashes");
    const billing = await portal.portalBilling(actorA());
    assert.deepEqual(billing.invoices.map((i) => i.number), [`A-INV-${tag}`]);
    const json = JSON.stringify(billing);
    assert.ok(!json.includes("SECRET"), "admin billing notes are never exposed");
    assert.ok(!json.includes("prov_secret"), "provider references are never exposed");
    await assert.rejects(portal.portalBilling({ id: "s", role: "ADMIN", operatorId: null }));
    await assert.rejects(portal.portalTeam({ id: "u", role: "OPERATOR", operatorId: null }));
  } finally {
    await prisma.invoice.deleteMany({ where: { number: { in: [`A-INV-${tag}`, `B-INV-${tag}`] } } });
  }
});
