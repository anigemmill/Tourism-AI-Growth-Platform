// Seeds a STAGING database with the synthetic demo cohort, once.
// Run by vercel-build.mjs on preview builds when STAGING_DATABASE=true and
// STAGING_SEED_DEMO=true. Does nothing if the database already has users,
// and refuses to run against the production project.

import { PrismaClient } from "../src/generated/prisma";
import { seedDestination } from "../src/lib/seed/destination";
import { seedGrowthOs, seedOptionsFromEnv } from "../src/lib/seed/growth";

import { pointsAtProduction } from "./database-url.mjs";

async function main() {
  if (pointsAtProduction([process.env.DATABASE_URL, process.env.DIRECT_URL])) {
    throw new Error("Refusing to seed: the database URL points at the production project.");
  }
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to seed in production.");
  if (process.env.STAGING_DATABASE !== "true") throw new Error("Refusing to seed: STAGING_DATABASE=true is not set.");
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
    await seedReviewExtras(prisma);
    console.log("Seeded staging database with the synthetic demo cohort.");
  } finally {
    await prisma.$disconnect();
  }
}

// Staging-only extras so the Reports and Billing screens have something to
// review: one shared brief per demo business, a manually recorded plan and
// two invoices (one paid, one outstanding). All amounts are illustrative.
async function seedReviewExtras(prisma: PrismaClient) {
  const DAY = 86_400_000;
  const now = Date.now();
  const founder = await prisma.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true, name: true } });
  const ops = await prisma.operator.findMany({ where: { isSynthetic: true, members: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  for (const [i, op] of ops.entries()) {
    await prisma.growthBrief.create({
      data: {
        operatorId: op.id,
        weekOf: new Date(now - 3 * DAY),
        whatChanged: [
          { text: "Enquiries mentioning AI assistants rose week on week (synthetic).", claimType: "OBSERVATION", source: "Demo signals", illustrative: true },
          { text: "Your booking page now loads in under 2 seconds on mobile (synthetic).", claimType: "FACT", source: "Demo site check", illustrative: true },
        ],
        whyItMatters: "Visitors increasingly ask AI assistants where to stay and what to do; clear, current details make you easier to recommend.",
        actions: [
          { action: "Add opening hours and prices to your Google Business Profile", why: "Assistants quote these directly", owner: "Operator", effort: "S", measure: "Profile completeness", needsApproval: false },
          { action: "Publish three FAQ answers on your website", why: "Gives assistants a source to cite", owner: "Operator", effort: "M", measure: "FAQ page live", needsApproval: false },
        ],
        learnings: "Demo data only.",
        dataGaps: ["No booking data shared yet (synthetic)"],
        generatedBy: "rules",
        status: "SHARED",
        approvedBy: founder?.name ?? "Programme team",
        approvedAt: new Date(now - 2 * DAY),
        createdBy: founder?.name ?? "Programme team",
      },
    });
    const amount = 14900 + i * 5000;
    const sub = await prisma.subscription.create({
      data: { operatorId: op.id, plan: i === 0 ? "Findable Growth (demo)" : "Findable Starter (demo)", status: "ACTIVE", interval: "MONTHLY", amountCents: amount, currentPeriodStart: new Date(now - 10 * DAY), renewalDate: new Date(now + 20 * DAY), notes: "SECRET staging admin note: must never appear in the portal" },
    });
    const paid = await prisma.invoice.create({
      data: { operatorId: op.id, subscriptionId: sub.id, number: `DEMO-${1001 + i * 10}`, status: "PAID", amountCents: amount, issuedAt: new Date(now - 40 * DAY), dueAt: new Date(now - 26 * DAY) },
    });
    await prisma.billingTransaction.create({
      data: { operatorId: op.id, invoiceId: paid.id, kind: "PAYMENT", status: "SUCCEEDED", amountCents: amount, occurredAt: new Date(now - 30 * DAY), method: "bank transfer", recordedById: founder?.id },
    });
    await prisma.invoice.create({
      data: { operatorId: op.id, subscriptionId: sub.id, number: `DEMO-${1002 + i * 10}`, status: "OPEN", amountCents: amount, issuedAt: new Date(now - 10 * DAY), dueAt: new Date(now + (i === 0 ? 4 : -3) * DAY) },
    });
  }
  console.log(`Added staging review extras for ${ops.length} demo business(es): shared briefs, plans and invoices (illustrative).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
