// A weekly brief can be shared with the business, so its input must only
// contain what the business can already see.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import { briefInputFor } from "../../src/lib/briefs";
import { buildBrief } from "../../src/lib/domain/brief";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const tag = randomBytes(4).toString("hex");
let A: string;

before(async () => {
  A = (await prisma.operator.create({ data: { name: `Brief A ${tag}`, category: "activity", status: "ACTIVE" } })).id;
  const opp = (title: string, visibility: "INTERNAL" | "CONFIDENTIAL") =>
    prisma.opportunity.create({ data: { operatorId: A, title, visibility, horizon: "NOW", status: "PRIORITISED", area: "OPERATIONS", solutionType: "PROCESS_CHANGE", problem: `${title} problem`, proposedSolution: "s" } });
  await opp(`visible-opp-${tag}`, "CONFIDENTIAL");
  await opp(`staff-only-opp-${tag}`, "INTERNAL");
  const past = new Date(Date.now() - 3 * 86_400_000);
  await prisma.task.createMany({
    data: [
      { title: `visible-task-${tag}`, operatorId: A, status: "BLOCKED", visibility: "CONFIDENTIAL" },
      { title: `staff-only-task-${tag}`, operatorId: A, status: "BLOCKED", dueDate: past, visibility: "INTERNAL" },
    ],
  });
  const signal = (title: string, visibility: "INTERNAL" | "CONFIDENTIAL") =>
    ({ operatorId: A, type: "review", title, summary: "s", source: "t", sourceTimestamp: new Date(), visibility, claimType: "OBSERVATION" as const, confidence: "MEDIUM" as const, createdBy: "t" });
  await prisma.signal.createMany({ data: [signal(`visible-signal-${tag}`, "CONFIDENTIAL"), signal(`staff-only-signal-${tag}`, "INTERNAL")] });
});

after(async () => {
  await prisma.operator.deleteMany({ where: { id: A } });
  await prisma.$disconnect();
});

test("a brief is built only from items the business can already see", async () => {
  const brief = buildBrief(await briefInputFor(A, new Date()), 10);
  const text = JSON.stringify(brief);
  assert.ok(text.includes(`visible-opp-${tag}`) && text.includes(`visible-task-${tag}`) && text.includes(`visible-signal-${tag}`));
  assert.ok(!text.includes("staff-only"), "staff-only items never reach a brief");
  // Wording addresses the business, not staff.
  assert.ok(!/operator|set an owner/i.test(text));
});
