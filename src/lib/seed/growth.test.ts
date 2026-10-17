import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSeedProblem } from "./growth";

test("demo data can never be seeded into production", () => {
  assert.equal(demoSeedProblem({ SEED_DEMO: "false" }), null);
  assert.equal(demoSeedProblem({ SEED_DEMO: "true", DATABASE_URL: "postgresql://app:app@localhost:5432/growthos_test" }), null);
  assert.match(demoSeedProblem({ SEED_DEMO: "true", VERCEL_ENV: "production" }) ?? "", /production/);
  assert.match(demoSeedProblem({ SEED_DEMO: "true", DIRECT_URL: "postgresql://postgres.HESCOABPCJUKMGEOPJNQ:x@db.example:5432/postgres" }) ?? "", /PRODUCTION project/);
  // Without SEED_DEMO the structural seed (programme skeleton, templates) is unaffected.
  assert.equal(demoSeedProblem({ VERCEL_ENV: "production" }), null);
});
