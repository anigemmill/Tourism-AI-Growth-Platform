// Admin & access management against a real Postgres database:
// invitations, password reset, password change, last-super-admin guard,
// RBAC overrides, tenant isolation and manual billing records.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.EMAIL_DEV_LOG = "off";

import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth/password";
import { attemptLogin, userForToken } from "../../src/lib/auth/core";
import { hashToken } from "../../src/lib/auth/tokens";
import { acceptInvite, changeOwnPassword, requestPasswordReset, resetPasswordWithToken } from "../../src/lib/auth/flows";
import { devOutbox } from "../../src/lib/email";
import * as admin from "../../src/lib/admin/users";
import * as billing from "../../src/lib/admin/billing";
import * as biz from "../../src/lib/admin/businesses";
import { ALL_PERMISSIONS, effectivePermissions } from "../../src/lib/rbac/permissions";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
const PW = "correct-horse-battery";
const mail = (n: string) => `${n}-${tag}@admin-test.example`;
let A: string, B: string;
let superId: string;

const superActor = (): admin.AdminActor => ({ id: superId, name: "Super", role: "FOUNDER", permissions: effectivePermissions("FOUNDER") });
const staffActor = (id = "staff-actor"): admin.AdminActor => ({
  id, name: "Staff", role: "ADMIN", permissions: effectivePermissions("ADMIN", [], [{ permission: "users.manage", granted: true }, { permission: "billing.manage", granted: true }, { permission: "businesses.manage", granted: true }]),
});

function linkFrom(to: string): string {
  const m = [...devOutbox].reverse().find((e) => e.to === to);
  assert.ok(m, `an email was sent to ${to}`);
  const url = m!.text.match(/https?:\/\/\S+/)![0];
  return new URL(url).searchParams.get("token")!;
}

before(async () => {
  A = (await prisma.operator.create({ data: { name: `Biz A ${tag}`, category: "activity" } })).id;
  B = (await prisma.operator.create({ data: { name: `Biz B ${tag}`, category: "activity" } })).id;
  superId = (await prisma.user.create({ data: { email: mail("super"), name: "Super", role: "FOUNDER", passwordHash: await hashPassword(PW) } })).id;
});

after(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: tag } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
  await prisma.billingTransaction.deleteMany({ where: { operatorId: { in: [A, B] } } });
  await prisma.invoice.deleteMany({ where: { operatorId: { in: [A, B] } } });
  await prisma.subscription.deleteMany({ where: { operatorId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { email: { contains: tag } } });
  await prisma.operator.deleteMany({ where: { id: { in: [A, B] } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: tag } } });
  await prisma.$disconnect();
});

test("invitation: pending user sets their own password through a single-use link", async () => {
  const r = await admin.inviteUser(superActor(), { name: "Olive Operator", email: mail("invitee").toUpperCase(), role: "OPERATOR", businessIds: [A] });
  assert.ok(r.ok, JSON.stringify(r));
  const u = await prisma.user.findUniqueOrThrow({ where: { email: mail("invitee") } });
  assert.equal(u.status, "PENDING");
  assert.equal(u.passwordHash, null);
  assert.equal((await attemptLogin(mail("invitee"), PW)).ok, false, "pending users cannot sign in");

  const token = linkFrom(mail("invitee"));
  assert.equal(await prisma.authToken.count({ where: { tokenHash: token } }), 0, "raw token never stored");
  assert.equal((await acceptInvite(token, "short")).ok, false, "weak password refused");
  const ok = await acceptInvite(token, PW);
  assert.ok(ok.ok);
  assert.equal((await acceptInvite(token, PW)).ok, false, "token is single-use");
  const login = await attemptLogin(mail("invitee"), PW);
  assert.ok(login.ok);
  if (login.ok) assert.equal(login.user.operatorId, A);
});

test("invitation: resending invalidates the earlier link; revoking stops it", async () => {
  await admin.inviteUser(superActor(), { name: "Rev", email: mail("revoke"), role: "ANALYST", businessIds: [] });
  const first = linkFrom(mail("revoke"));
  const u = await prisma.user.findUniqueOrThrow({ where: { email: mail("revoke") } });
  assert.ok((await admin.resendInvite(superActor(), u.id)).ok);
  const second = linkFrom(mail("revoke"));
  assert.notEqual(first, second);
  assert.equal((await acceptInvite(first, PW)).ok, false, "old link revoked");
  assert.ok((await admin.revokeInvite(superActor(), u.id)).ok);
  assert.equal((await acceptInvite(second, PW)).ok, false, "revoked invite unusable");
  // A revoked invitation can be sent again, and works.
  assert.ok((await admin.inviteUser(superActor(), { name: "Rev", email: mail("revoke"), role: "ANALYST", businessIds: [] })).ok);
  assert.ok((await acceptInvite(linkFrom(mail("revoke")), PW)).ok);
  const again = await admin.inviteUser(superActor(), { name: "Rev", email: mail("revoke"), role: "ANALYST", businessIds: [] });
  assert.equal(again.ok, false, "an activated account can't be re-invited");
});

test("re-inviting a revoked invitee grants only the newly selected businesses", async () => {
  const email = mail("reinvite");
  assert.ok((await admin.inviteUser(superActor(), { name: "Re", email, role: "OPERATOR", businessIds: [A] })).ok);
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.ok((await admin.revokeInvite(superActor(), u.id)).ok);
  assert.equal(await prisma.userBusiness.count({ where: { userId: u.id } }), 0, "revoking removes business links");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).operatorId, null);

  assert.ok((await admin.inviteUser(superActor(), { name: "Re", email, role: "OPERATOR", businessIds: [B] })).ok);
  assert.ok((await acceptInvite(linkFrom(email), PW)).ok);
  const login = await attemptLogin(email, PW);
  assert.ok(login.ok);
  if (!login.ok) return;
  assert.equal(login.user.operatorId, B);
  const links = await prisma.userBusiness.findMany({ where: { userId: u.id }, select: { operatorId: true } });
  assert.deepEqual(links.map((l) => l.operatorId), [B], "only the re-invite's business is linked");
  // Pointing the session at the old business (as switching would) is ignored.
  await prisma.user.update({ where: { id: u.id }, data: { operatorId: A } });
  assert.equal((await userForToken(login.token))?.operatorId, B);
});

test("re-inviting a pending invitee replaces, not adds to, their businesses", async () => {
  const email = mail("pending-reinvite");
  assert.ok((await admin.inviteUser(superActor(), { name: "Pe", email, role: "OPERATOR", businessIds: [A] })).ok);
  assert.ok((await admin.inviteUser(superActor(), { name: "Pe", email, role: "OPERATOR", businessIds: [B] })).ok);
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  const links = await prisma.userBusiness.findMany({ where: { userId: u.id }, select: { operatorId: true } });
  assert.deepEqual(links.map((l) => l.operatorId), [B]);
  assert.equal(u.operatorId, B);
  // Re-invited as staff with no businesses: no business links remain.
  assert.ok((await admin.inviteUser(superActor(), { name: "Pe", email, role: "ANALYST", businessIds: [] })).ok);
  assert.equal(await prisma.userBusiness.count({ where: { userId: u.id } }), 0);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).operatorId, null);
});

test("legacy active flag mirrors status both ways (previous release + rollback safety)", async () => {
  const email = mail("legacy");
  const u = await prisma.user.create({ data: { email, name: "L", role: "ANALYST", passwordHash: await hashPassword(PW) } });
  const flag = async () => (await prisma.$queryRaw<{ active: boolean; status: string }[]>`SELECT active, status::text FROM "User" WHERE id = ${u.id}`)[0];
  assert.deepEqual(await flag(), { active: true, status: "ACTIVE" });
  await prisma.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
  assert.deepEqual(await flag(), { active: false, status: "SUSPENDED" });
  await prisma.$executeRaw`UPDATE "User" SET active = true WHERE id = ${u.id}`; // what the old "Reactivate" did
  assert.deepEqual(await flag(), { active: true, status: "ACTIVE" });
  await prisma.$executeRaw`UPDATE "User" SET active = false WHERE id = ${u.id}`; // old "Deactivate"
  assert.deepEqual(await flag(), { active: false, status: "ARCHIVED" });
  const p = await prisma.user.create({ data: { email: mail("legacy-pending"), name: "P", role: "ANALYST", status: "PENDING" } });
  assert.equal((await prisma.$queryRaw<{ active: boolean }[]>`SELECT active FROM "User" WHERE id = ${p.id}`)[0].active, false, "invited users are never active");
});

test("password reset: generic for unknown emails; link resets once, signs out everywhere", async () => {
  const before = devOutbox.length;
  await requestPasswordReset(mail("nobody"));
  assert.equal(devOutbox.length, before, "no email for unknown address");

  const login = await attemptLogin(mail("invitee"), PW);
  assert.ok(login.ok);
  await requestPasswordReset(mail("invitee"));
  const token = linkFrom(mail("invitee"));
  const NEW = "a-brand-new-passphrase";
  assert.ok((await resetPasswordWithToken(token, NEW)).ok);
  assert.equal((await resetPasswordWithToken(token, "another-new-passphrase")).ok, false, "single use");
  if (login.ok) assert.equal(await userForToken(login.token), null, "existing sessions revoked");
  assert.equal((await attemptLogin(mail("invitee"), PW)).ok, false);
  assert.ok((await attemptLogin(mail("invitee"), NEW)).ok);
});

test("password reset: expired tokens are rejected", async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: mail("invitee") } });
  const raw = `expired-${tag}`;
  await prisma.authToken.create({ data: { userId: u.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(raw), expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await resetPasswordWithToken(raw, "whatever-long-enough")).ok, false);
});

test("change own password requires the current one and keeps only this session", async () => {
  const email = mail("changer");
  await prisma.user.create({ data: { email, name: "Changer", role: "ANALYST", passwordHash: await hashPassword(PW) } });
  const s1 = await attemptLogin(email, PW);
  const s2 = await attemptLogin(email, PW);
  assert.ok(s1.ok && s2.ok);
  if (!s1.ok || !s2.ok) return;
  assert.equal((await changeOwnPassword(s1.user.id, "wrong-current-pw", "new-password-12345", s1.user.sessionId)).ok, false);
  assert.ok((await changeOwnPassword(s1.user.id, PW, "new-password-12345", s1.user.sessionId)).ok);
  assert.ok(await userForToken(s1.token), "current session kept");
  assert.equal(await userForToken(s2.token), null, "other sessions revoked");
});

test("the last active super admin can't be suspended, deactivated or demoted", async () => {
  const others = await prisma.user.count({ where: { role: "FOUNDER", status: "ACTIVE", id: { not: superId } } });
  if (others > 0) return; // only meaningful on a database with a single super admin
  const ghost: admin.AdminActor = { ...superActor(), id: "someone-else" };
  for (const r of [
    await admin.setUserStatus(ghost, superId, "SUSPENDED"),
    await admin.setUserStatus(ghost, superId, "ARCHIVED"),
    await admin.changeRole(ghost, superId, "ADMIN"),
  ]) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /last active super admin/);
  }
  const self = await admin.setUserStatus(superActor(), superId, "SUSPENDED");
  assert.equal(self.ok, false, "nobody can change their own status");
  // With a second super admin, the first can be demoted.
  const second = await prisma.user.create({ data: { email: mail("super2"), name: "Super 2", role: "FOUNDER", passwordHash: await hashPassword(PW) } });
  const demote = await admin.changeRole({ ...superActor(), id: second.id }, superId, "ADMIN");
  assert.ok(demote.ok);
  await prisma.user.update({ where: { id: superId }, data: { role: "FOUNDER" } });
  await prisma.user.delete({ where: { id: second.id } });
});

test("non-super-admins can't touch super admin accounts or assign staff roles", async () => {
  const s = staffActor();
  const r = await admin.setUserStatus(s, superId, "SUSPENDED");
  assert.equal(r.ok, false);
  const inv = await admin.inviteUser(s, { name: "x", email: mail("escalate"), role: "FOUNDER", businessIds: [] });
  assert.equal(inv.ok, false);
  await admin.inviteUser(superActor(), { name: "Pending super", email: mail("pending-super"), role: "FOUNDER", businessIds: [] });
  const hijack = await admin.inviteUser(s, { name: "x", email: mail("pending-super"), role: "ANALYST", businessIds: [] });
  assert.equal(hijack.ok, false, "staff can't re-invite a pending super admin");
  const inv2 = await admin.inviteUser(s, { name: "x", email: mail("escalate2"), role: "ADMIN", businessIds: [] });
  assert.equal(inv2.ok, false, "users.roles is needed to invite staff");
  const perm = await admin.setUserPermission(s, superId, "billing.view", true);
  assert.equal(perm.ok, false);
});

test("permission overrides apply per request; operators can never hold staff permissions", async () => {
  const email = mail("analyst");
  const u = await prisma.user.create({ data: { email, name: "Ana", role: "ANALYST", passwordHash: await hashPassword(PW) } });
  const login = await attemptLogin(email, PW);
  assert.ok(login.ok);
  if (!login.ok) return;
  assert.ok(!login.user.permissions.includes("operators.edit"), "analysts are read-only by default");
  assert.ok((await admin.setUserPermission(superActor(), u.id, "operators.edit", true)).ok);
  assert.ok((await userForToken(login.token))!.permissions.includes("operators.edit"));
  assert.ok((await admin.setUserPermission(superActor(), u.id, "operators.view", false)).ok);
  assert.ok(!(await userForToken(login.token))!.permissions.includes("operators.view"));

  const op = await prisma.user.findUniqueOrThrow({ where: { email: mail("invitee") } });
  const bad = await admin.setUserPermission(superActor(), op.id, "operators.view", true);
  assert.equal(bad.ok, false);
  assert.ok(!effectivePermissions("OPERATOR", [{ permission: "billing.view", granted: true }]).includes("billing.view"));
  assert.ok(!effectivePermissions("ADMIN", [{ permission: "users.roles", granted: true }]).includes("users.roles"), "role assignment is super-admin only");
  assert.deepEqual(effectivePermissions("FOUNDER", [], [{ permission: "billing.view", granted: false }]), ALL_PERMISSIONS);
});

test("tenant isolation: an operator can only ever use a business they belong to, while it's active", async () => {
  const op = await prisma.user.findUniqueOrThrow({ where: { email: mail("invitee") } });
  const login = await attemptLogin(mail("invitee"), "a-brand-new-passphrase");
  assert.ok(login.ok);
  if (!login.ok) return;
  // Tampered current business (not a membership) is ignored.
  await prisma.user.update({ where: { id: op.id }, data: { operatorId: B } });
  assert.equal((await userForToken(login.token))?.operatorId, A);
  // Second membership is usable once linked.
  assert.ok((await admin.linkBusiness(superActor(), op.id, B)).ok);
  assert.equal((await userForToken(login.token))?.operatorId, B);
  // Suspending business B falls back to A; suspending A as well blocks access.
  assert.ok((await biz.setAccountStatus(superActor(), B, "SUSPENDED")).ok);
  assert.equal((await userForToken(login.token))?.operatorId, A);
  assert.ok((await biz.setAccountStatus(superActor(), A, "SUSPENDED")).ok);
  assert.equal(await userForToken(login.token), null);
  await prisma.operator.updateMany({ where: { id: { in: [A, B] } }, data: { accountStatus: "ACTIVE" } });
  // Unlinking the last business of an active operator is refused.
  assert.ok((await admin.unlinkBusiness(superActor(), op.id, B)).ok);
  assert.equal((await admin.unlinkBusiness(superActor(), op.id, A)).ok, false);
});

test("suspending a user signs them out and blocks sign-in until reactivated", async () => {
  const email = mail("suspend");
  const u = await prisma.user.create({ data: { email, name: "Sus", role: "PROGRAMME_MANAGER", passwordHash: await hashPassword(PW) } });
  const login = await attemptLogin(email, PW);
  assert.ok(login.ok);
  assert.ok((await admin.setUserStatus(superActor(), u.id, "SUSPENDED")).ok);
  if (login.ok) assert.equal(await userForToken(login.token), null);
  assert.equal((await attemptLogin(email, PW)).ok, false);
  assert.ok((await admin.setUserStatus(superActor(), u.id, "ACTIVE")).ok);
  assert.ok((await attemptLogin(email, PW)).ok);
  const log = await prisma.auditLog.findFirst({ where: { entityId: u.id, action: "user.suspend" } });
  assert.ok(log, "suspension audited");
});

test("billing: records are always manual, card numbers are refused, cross-business links rejected", async () => {
  const actor = staffActor(superId);
  const inv = await billing.createInvoice(actor, A, { number: `INV-${tag}`, amountCents: 50000, currency: "NZD", issuedAt: new Date(), status: "OPEN" });
  assert.ok(inv.ok);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { number: `INV-${tag}` } });
  assert.equal(invoice.source, "MANUAL");

  const card = await billing.recordTransaction(actor, A, { kind: "PAYMENT", status: "SUCCEEDED", amountCents: 100, currency: "NZD", occurredAt: new Date(), note: "card 4242 4242 4242 4242" });
  assert.equal(card.ok, false, "card number refused");

  const cross = await billing.recordTransaction(actor, B, { kind: "PAYMENT", status: "SUCCEEDED", amountCents: 100, currency: "NZD", occurredAt: new Date(), invoiceId: invoice.id });
  assert.equal(cross.ok, false, "invoice of another business refused");

  const failed = await billing.recordTransaction(actor, A, { kind: "PAYMENT", status: "FAILED", amountCents: 50000, currency: "NZD", occurredAt: new Date(), invoiceId: invoice.id, failureReason: "Declined" });
  assert.ok(failed.ok);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "OPEN", "failed payment doesn't settle");
  const paid = await billing.recordTransaction(actor, A, { kind: "PAYMENT", status: "SUCCEEDED", amountCents: 50000, currency: "NZD", occurredAt: new Date(), invoiceId: invoice.id, method: "bank transfer" });
  assert.ok(paid.ok);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "PAID");
  const txns = await prisma.billingTransaction.findMany({ where: { operatorId: A } });
  assert.ok(txns.every((t) => t.source === "MANUAL"));
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "billing.payment_record", entityId: A } }));

  const adj = await billing.recordTransaction(actor, A, { kind: "CREDIT", status: "SUCCEEDED", amountCents: 100, currency: "NZD", occurredAt: new Date() });
  assert.equal(adj.ok, false, "adjustments need a note");
  const noPerm = await billing.recordTransaction({ ...actor, permissions: ["billing.view"] }, A, { kind: "PAYMENT", status: "SUCCEEDED", amountCents: 100, currency: "NZD", occurredAt: new Date() });
  assert.equal(noPerm.ok, false);
});
