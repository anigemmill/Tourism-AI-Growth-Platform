import { PrismaClient } from "@/generated/prisma";
import { normalizeDatabaseUrl, withConnectTimeout } from "@/lib/db-url";

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
