import { PrismaClient } from "@/generated/prisma";
import { normalizeDatabaseUrl, productionDatabaseProblem, withConnectTimeout } from "@/lib/db-url";

// Previews must never reach the production database (docs/STAGING.md).
const problem = productionDatabaseProblem(process.env.VERCEL_ENV, [process.env.DATABASE_URL, process.env.DIRECT_URL]);
if (problem) throw new Error(problem);

// Standard Next.js dev-mode singleton to avoid exhausting Postgres
// connections on hot reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: withConnectTimeout(normalizeDatabaseUrl(process.env.DATABASE_URL), 15) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
