// Seeds a STAGING database with the synthetic demo cohort, once.
// Run by vercel-build.mjs on preview builds when STAGING_DATABASE=true and
// STAGING_SEED_DEMO=true. Does nothing if the database already has users,
// and refuses to run against the production project.

import { PrismaClient } from "../src/generated/prisma";
import { seedDestination } from "../src/lib/seed/destination";
import { seedGrowthOs, seedOptionsFromEnv } from "../src/lib/seed/growth";

const PRODUCTION_DB_REF = "hescoabpcjukmgeopjnq";

async function main() {
  if ([process.env.DATABASE_URL, process.env.DIRECT_URL].some((v) => v?.includes(PRODUCTION_DB_REF))) {
    throw new Error("Refusing to seed: DATABASE_URL points at the production project.");
  }
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to seed in production.");
  const prisma = new PrismaClient();
  try {
    if ((await prisma.user.count()) > 0) {
      console.log("Staging database already has users; demo seed skipped.");
      return;
    }
    if (!process.env.SEED_DEMO_PASSWORD || !process.env.SEED_FOUNDER_PASSWORD || !process.env.SEED_FOUNDER_EMAIL) {
      console.log("Set SEED_FOUNDER_EMAIL, SEED_FOUNDER_PASSWORD and SEED_DEMO_PASSWORD (Preview only) to seed demo accounts; skipped.");
      return;
    }
    process.env.SEED_DEMO = "true";
    await seedDestination(prisma);
    await seedGrowthOs(prisma, seedOptionsFromEnv());
    console.log("Seeded staging database with the synthetic demo cohort.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
