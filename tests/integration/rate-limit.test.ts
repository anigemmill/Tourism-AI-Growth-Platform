// Integration tests against a real Postgres database. Run with
//   TEST_DATABASE_URL=postgresql://…/growthos_test npm run test:integration

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import { checkRateLimit } from "../../src/lib/rate-limit";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run integration tests: DATABASE_URL must point at a *test* database.");
}

const key = `rl-${randomBytes(4).toString("hex")}`;

test("rate limit allows up to the max, then blocks", async () => {
  for (let i = 0; i < 3; i++) {
    const r = await checkRateLimit(key, 60_000, 3);
    assert.equal(r.allowed, true);
  }
  const blocked = await checkRateLimit(key, 60_000, 3);
  assert.equal(blocked.allowed, false);
});

test("rate limit keys are independent", async () => {
  const otherKey = `rl-other-${randomBytes(4).toString("hex")}`;
  const r = await checkRateLimit(otherKey, 60_000, 1);
  assert.equal(r.allowed, true, "a fresh key must not be affected by another key's hits");
});

test("rate limit only counts hits inside the window", async () => {
  const shortKey = `rl-short-${randomBytes(4).toString("hex")}`;
  await checkRateLimit(shortKey, 50, 1);
  const blocked = await checkRateLimit(shortKey, 50, 1);
  assert.equal(blocked.allowed, false);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const afterWindow = await checkRateLimit(shortKey, 50, 1);
  assert.equal(afterWindow.allowed, true, "a hit outside the window must not count against the limit");
});

after(async () => {
  await prisma.rateLimitHit.deleteMany({ where: { key: { startsWith: "rl-" } } });
  await prisma.$disconnect();
});
