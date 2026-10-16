// Plan publication: staff-only drafts reach the client portal only when a
// member of staff shows them, and can be hidden again.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import * as portal from "../../src/lib/dal/portal";
import { setClientVisibility } from "../../src/lib/plan/visibility";
import { effectivePermissions } from "../../src/lib/rbac/permissions";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
let A: string, B: string, staffId: string;
const opp = (operatorId: string | null, title: string, visibility: "INTERNAL" | "CONFIDENTIAL" | "COHORT" = "INTERNAL") =>
  prisma.opportunity.create({ data: { operatorId, title, visibility, area: "OPERATIONS", solutionType: "PROCESS_CHANGE", problem: "p", proposedSolution: "s" } });

before(async () => {
  A = (await prisma.operator.create({ data: { name: `Pub A ${tag}`, category: "activity", status: "ACTIVE" } })).id;
  B = (await prisma.operator.create({ data: { name: `Pub B ${tag}`, category: "activity", status: "ACTIVE" } })).id;
  staffId = (await prisma.user.create({ data: { email: `pub-staff-${tag}@test.example`, name: "Staff", role: "PROGRAMME_MANAGER" } })).id;
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: staffId } });
  await prisma.opportunity.deleteMany({ where: { title: { contains: tag } } });
  await prisma.task.deleteMany({ where: { title: { contains: tag } } });
  await prisma.project.deleteMany({ where: { title: { contains: tag } } });
  await prisma.operator.deleteMany({ where: { id: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: staffId } });
  await prisma.$disconnect();
});

const staff = () => ({ id: staffId, permissions: effectivePermissions("PROGRAMME_MANAGER") });
const client = (operatorId: string) => ({ id: "x", role: "OPERATOR" as const, operatorId });

test("a staff-only plan item reaches the client only after it's shown, and leaves when hidden", async () => {
  const o = await opp(A, `draft-${tag}`);
  const t = await prisma.task.create({ data: { title: `draft-task-${tag}`, operatorId: A, visibility: "INTERNAL" } });
  const titles = async () => (await portal.portalOpportunities(client(A))).map((x) => x.title);
  assert.ok(!(await titles()).includes(`draft-${tag}`), "draft hidden from the client");

  const shown = await setClientVisibility(staff(), "opportunity", o.id, true);
  assert.ok(shown.ok, JSON.stringify(shown));
  assert.ok((await titles()).includes(`draft-${tag}`), "shown to the client");
  assert.ok(!(await portal.portalOpportunities(client(B))).some((x) => x.id === o.id), "never to another business");

  assert.ok((await setClientVisibility(staff(), "task", t.id, true)).ok);
  assert.ok((await portal.portalTasks(client(A))).some((x) => x.id === t.id));

  assert.ok((await setClientVisibility(staff(), "opportunity", o.id, false)).ok);
  assert.ok(!(await titles()).includes(`draft-${tag}`), "hidden again");

  const log = await prisma.auditLog.findMany({ where: { actorId: staffId, entityId: o.id }, orderBy: { createdAt: "asc" }, select: { action: true } });
  assert.deepEqual(log.map((l) => l.action), ["plan.show_to_client", "plan.hide_from_client"]);
});

test("the switch needs the edit permission and never widens or narrows wider sharing", async () => {
  const o = await opp(A, `perm-${tag}`);
  const noEdit = { id: staffId, permissions: effectivePermissions("ANALYST").filter((p) => p !== "opportunities.edit") };
  const refused = await setClientVisibility(noEdit, "opportunity", o.id, true);
  assert.equal(refused.ok, false);
  assert.equal((await prisma.opportunity.findUniqueOrThrow({ where: { id: o.id } })).visibility, "INTERNAL");

  const cohort = await opp(A, `cohort-${tag}`, "COHORT");
  assert.equal((await setClientVisibility(staff(), "opportunity", cohort.id, false)).ok, false, "cohort sharing is changed in the edit form");
  assert.equal((await prisma.opportunity.findUniqueOrThrow({ where: { id: cohort.id } })).visibility, "COHORT");

  const programmeLevel = await opp(null, `programme-${tag}`);
  assert.equal((await setClientVisibility(staff(), "opportunity", programmeLevel.id, true)).ok, false, "no business, no client to show");

  assert.equal((await setClientVisibility(staff(), "project", "doesnotexist0000", true)).ok, false);
});
