// `npm run db:seed` — structural data only, plus accounts from SEED_* env.
//
// - Destination reference data (Rotorua): no observations are ever seeded
//   (docs/ARCHITECTURE.md §1 — never invent tourism statistics).
// - Growth OS: programme skeleton, solution templates, workflow library,
//   founder account; and a SYNTHETIC demo cohort only when SEED_DEMO=true.
//
// On a hosted deployment you can instead create the founder account in the
// browser at /setup (see docs/DEPLOYMENT.md).

import { PrismaClient } from "../src/generated/prisma";
import { seedDestination } from "../src/lib/seed/destination";
import { demoSeedProblem, seedGrowthOs, seedOptionsFromEnv } from "../src/lib/seed/growth";

const prisma = new PrismaClient();

async function main() {
  const refused = demoSeedProblem();
  if (refused) throw new Error(refused);
  const d = await seedDestination(prisma);
  console.log(`Seeded destination "${d.destination.name}", ${d.categories} experience categories, ${d.prompts} tracked prompts.`);
  await seedGrowthOs(prisma, seedOptionsFromEnv());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
