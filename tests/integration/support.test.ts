// Super Admin client view ("View as client"): server-side security tests.
// Calls the same functions the server actions call, with real sessions.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth/password";
import { attemptLogin, revokeToken, userForToken } from "../../src/lib/auth/core";
import * as portal from "../../src/lib/dal/portal";
import {
  activeEditGrant, clientViewActor, enterEditMode, leaveEditMode, recordView, supportBusiness, teamAction, updateBusinessDetails,
  type SupportAdmin,
} from "../../src/lib/support/core";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
const PW = "correct-horse-battery";
const email = (k: string) => `sv-${k.toLowerCase()}-${tag}@test.example`;
let A: string, B: string;
const ids: Record<string, string> = {};

async function signIn(k: string): Promise<{ admin: SupportAdmin; token: string }> {
  const r = await attemptLogin(email(k), PW);
  assert.ok(r.ok, `sign-in failed for ${k}: ${r.ok ? "" : r.error}`);
  const u = await userForToken(r.token);
  assert.ok(u);
  return { admin: u, token: r.token };
}

const details = (name: string) => ({ name, category: "activity", websiteUrl: "https://a.example", bookingUrl: undefined, contactName: "Pat", contactEmail: "pat@a.example", contactPhone: undefined });

before(async () => {
  A = (await prisma.operator.create({ data: { name: `SV A ${tag}`, category: "activity", status: "ACTIVE", internalNotes: "SECRET-A" } })).id;
  B = (await prisma.operator.create({ data: { name: `SV B ${tag}`, category: "accommodation", status: "ACTIVE" } })).id;
  const hash = await hashPassword(PW);
  const mk = async (k: string, role: "FOUNDER" | "ADMIN" | "PROGRAMME_MANAGER" | "OPERATOR", extra: Record<string, unknown> = {}) => {
    ids[k] = (await prisma.user.create({ data: { email: email(k), name: `SV ${k}`, role, passwordHash: hash, ...extra } })).id;
  };
  await mk("founder", "FOUNDER");
  await mk("admin", "ADMIN");
  await mk("pm", "PROGRAMME_MANAGER");
  await mk("opA", "OPERATOR", { operatorId: A });
  await mk("opA2", "OPERATOR", { operatorId: A });
  await mk("pendingA", "OPERATOR", { operatorId: A, status: "PENDING", passwordHash: null });
  await mk("opB", "OPERATOR", { operatorId: B });
  await prisma.userBusiness.createMany({
    data: [
      { userId: ids.opA, operatorId: A }, { userId: ids.opA2, operatorId: A }, { userId: ids.pendingA, operatorId: A }, { userId: ids.opB, operatorId: B },
    ],
  });
  const opp = (operatorId: string, title: string, visibility: "INTERNAL" | "CONFIDENTIAL") =>
    prisma.opportunity.create({ data: { operatorId, title, visibility, area: "OPERATIONS", solutionType: "PROCESS_CHANGE", problem: "p", proposedSolution: "s" } });
  await opp(A, `A-conf-${tag}`, "CONFIDENTIAL");
  await opp(A, `A-internal-${tag}`, "INTERNAL");
  await opp(B, `B-conf-${tag}`, "CONFIDENTIAL");
  await prisma.invoice.create({ data: { operatorId: B, number: `SV-B-${tag}`, amountCents: 100, issuedAt: new Date(), status: "OPEN", notes: "SECRET-B-NOTE" } });
});

after(async () => {
  const users = Object.values(ids);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: [A, B, ...users] } }] } });
  await prisma.invoice.deleteMany({ where: { operatorId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.operator.deleteMany({ where: { id: { in: [A, B] } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: tag } } });
  await prisma.$disconnect();
});

test("only Super Admins can use the client view (role checked on every call)", async () => {
  for (const k of ["admin", "pm", "opA"]) {
    const { admin } = await signIn(k);
    assert.throws(() => clientViewActor(admin, A), /Only Super Admins/, `${k} must not get a client-view actor`);
    await assert.rejects(enterEditMode(admin, A), /Only Super Admins/, `${k} must not enter edit mode`);
    assert.equal(await activeEditGrant(admin, A), null);
    const u = await updateBusinessDetails(admin, A, details("hijack"));
    assert.equal(u.ok, false, `${k} must not edit`);
    const t = await teamAction(admin, A, ids.opA, "password_reset");
    assert.equal(t.ok, false, `${k} must not run team actions`);
  }
  assert.equal((await prisma.operator.findUniqueOrThrow({ where: { id: A } })).name, `SV A ${tag}`);
});

test("client view shows exactly the client's data: own business, no internal records, no other tenant", async () => {
  const { admin } = await signIn("founder");
  const actor = clientViewActor(admin, A);
  const titles = (await portal.portalOpportunities(actor)).map((o) => o.title);
  assert.ok(titles.includes(`A-conf-${tag}`));
  assert.ok(!titles.includes(`A-internal-${tag}`), "INTERNAL records hidden, as for the client");
  assert.ok(!titles.includes(`B-conf-${tag}`), "other business hidden");
  const team = await portal.portalTeam(actor);
  assert.deepEqual(new Set(team.map((m) => m.id)), new Set([ids.opA, ids.opA2, ids.pendingA]));
  const billing = await portal.portalBilling(actor);
  assert.equal(billing.invoices.length, 0, "B's invoice not visible in A's view");
  const biz = await portal.portalBusiness(actor);
  assert.equal(biz.id, A);
  assert.ok(!JSON.stringify(biz).includes("SECRET-A"), "internal notes never selected");
});

test("malformed or unknown business ids are rejected", async () => {
  const { admin } = await signIn("founder");
  assert.equal(await supportBusiness("../../etc"), null);
  assert.equal(await supportBusiness("nonexistentbusinessid1"), null);
  await assert.rejects(enterEditMode(admin, "nonexistentbusinessid1"), /doesn't exist/);
});

test("read-only by default: every change is refused without an edit grant", async () => {
  const { admin } = await signIn("founder");
  assert.equal(await activeEditGrant(admin, A), null);
  const u = await updateBusinessDetails(admin, A, details("Changed while read-only"));
  assert.deepEqual(u, { ok: false, error: "Edit mode is off or has expired. Turn on edit mode to make changes." });
  const t = await teamAction(admin, A, ids.opA, "suspend");
  assert.equal(t.ok, false);
  assert.equal((await prisma.operator.findUniqueOrThrow({ where: { id: A } })).name, `SV A ${tag}`);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids.opA } })).status, "ACTIVE");
});

test("edit grant: allows changes for that business only, and is audited", async () => {
  const { admin } = await signIn("founder");
  const grant = await enterEditMode(admin, A);
  assert.equal(grant.sessionId, admin.sessionId);
  const r = await updateBusinessDetails(admin, A, details(`SV A edited ${tag}`));
  assert.equal(r.ok, true);
  const op = await prisma.operator.findUniqueOrThrow({ where: { id: A } });
  assert.equal(op.name, `SV A edited ${tag}`);
  assert.equal(op.internalNotes, "SECRET-A", "fields outside the form are untouched");

  // Cross-business: the A grant does not allow edits to B.
  const rb = await updateBusinessDetails(admin, B, details("Hijacked B"));
  assert.equal(rb.ok, false);
  assert.equal((await prisma.operator.findUniqueOrThrow({ where: { id: B } })).name, `SV B ${tag}`);
  // A user from B can't be targeted through A's view, nor A's through B's.
  assert.deepEqual(await teamAction(admin, A, ids.opB, "password_reset"), { ok: false, error: "That person isn't on this business's team." });
  assert.equal((await teamAction(admin, A, ids.opB, "suspend")).ok, false);
  assert.equal((await teamAction(admin, B, ids.opA, "suspend")).ok, false);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids.opB } })).status, "ACTIVE");

  const logs = await prisma.auditLog.findMany({ where: { actorId: admin.id, entityId: A }, orderBy: { createdAt: "asc" } });
  const start = logs.find((l) => l.action === "support.edit_start");
  const upd = logs.find((l) => l.action === "update");
  assert.ok(start && upd, "edit start and update audited against the business");
  assert.equal((upd!.changes as { onBehalfOf: string }).onBehalfOf, A);
  assert.equal((upd!.changes as { grantId: string }).grantId, grant.id);
  assert.ok(upd!.createdAt instanceof Date);
  await leaveEditMode(admin, A);
});

test("edit grant ends on expiry and on leave; switching business revokes the old grant", async () => {
  const { admin } = await signIn("founder");
  const g = await enterEditMode(admin, A);
  await prisma.supportEditGrant.update({ where: { id: g.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await activeEditGrant(admin, A), null, "expired grant is not active");
  assert.equal((await updateBusinessDetails(admin, A, details("After expiry"))).ok, false);

  await enterEditMode(admin, A);
  assert.equal(await leaveEditMode(admin, A), 1);
  assert.equal((await updateBusinessDetails(admin, A, details("After leave"))).ok, false);
  assert.ok(await prisma.auditLog.findFirst({ where: { actorId: admin.id, entityId: A, action: "support.edit_end" } }));

  await enterEditMode(admin, A);
  await enterEditMode(admin, B);
  assert.equal(await activeEditGrant(admin, A), null, "one business at a time per session");
  assert.ok(await activeEditGrant(admin, B));
  await leaveEditMode(admin, B);
});

test("edit grant is bound to the sign-in session: other sessions can't use it, signing out removes it", async () => {
  const s1 = await signIn("founder");
  const s2 = await signIn("founder");
  const g = await enterEditMode(s1.admin, A);
  assert.equal(await activeEditGrant(s2.admin, A), null, "a second session has no grant");
  assert.equal((await updateBusinessDetails(s2.admin, A, details("From other session"))).ok, false);
  // A forged admin object claiming s1's session id still needs the matching user.
  const forged: SupportAdmin = { ...s2.admin, id: ids.admin, role: "FOUNDER" };
  assert.equal(await activeEditGrant(forged, A), null);

  await revokeToken(s1.token);
  assert.equal(await userForToken(s1.token), null, "signed out");
  assert.equal(await prisma.supportEditGrant.findUnique({ where: { id: g.id } }), null, "grant deleted with the session");
  await assert.rejects(enterEditMode(s1.admin, A), /session has ended/, "a dead session can't get a new grant");
});

test("existing permissions are still required on top of the grant", async () => {
  const { admin } = await signIn("founder");
  await enterEditMode(admin, A);
  const noPerms: SupportAdmin = { ...admin, permissions: [] };
  assert.deepEqual(await updateBusinessDetails(noPerms, A, details("x")), { ok: false, error: "You don't have permission to do that." });
  assert.equal((await teamAction(noPerms, A, ids.opA, "password_reset")).ok, false);
  await leaveEditMode(admin, A);
});

test("team actions reuse existing account management, stay on this business and never expose passwords", async () => {
  const { admin } = await signIn("founder");
  await enterEditMode(admin, A);
  const reset = await teamAction(admin, A, ids.opA, "password_reset");
  assert.equal(reset.ok, true);
  const invite = await teamAction(admin, A, ids.pendingA, "resend_invite");
  assert.equal(invite.ok, true);
  for (const r of [reset, invite]) assert.ok(!JSON.stringify(r).toLowerCase().includes("passwordhash"));

  const { token: opToken } = await (async () => { const r = await attemptLogin(email("opA2"), PW); assert.ok(r.ok); return r; })();
  const s = await teamAction(admin, A, ids.opA2, "suspend");
  assert.equal(s.ok, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids.opA2 } })).status, "SUSPENDED");
  assert.equal(await userForToken(opToken), null, "suspended user signed out immediately");
  const back = await teamAction(admin, A, ids.opA2, "reactivate");
  assert.equal(back.ok, true);

  const logged = await prisma.auditLog.findMany({ where: { actorId: admin.id, entityId: A, action: "support.team_action" } });
  assert.equal(logged.length, 4);
  assert.ok(logged.every((l) => (l.changes as { onBehalfOf: string }).onBehalfOf === A));
  await leaveEditMode(admin, A);
});

test("viewing is audited, at most once per page per 5 minutes", async () => {
  const { admin } = await signIn("founder");
  assert.equal(await recordView(admin, B, "Overview"), true);
  assert.equal(await recordView(admin, B, "Overview"), false);
  assert.equal(await recordView(admin, B, "Reports"), true);
  const views = await prisma.auditLog.findMany({ where: { actorId: admin.id, entityId: B, action: "support.view" } });
  assert.equal(views.length, 2);
  const { admin: staff } = await signIn("admin");
  await assert.rejects(recordView(staff, B, "Overview"), /Only Super Admins/);
});
