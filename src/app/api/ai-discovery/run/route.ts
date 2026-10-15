import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { runAIDiscovery } from "@/lib/engine/ai-discovery";
import { getActiveDestinationConfig } from "@/config/destinations";
import { checkRateLimit } from "@/lib/rate-limit";

// LLM-backed and cost-incurring — bound how often one account can trigger it.
const WINDOW_MS = 10 * 60_000;
const MAX_RUNS = 5;

export async function POST() {
  const session = await getSession();
  if (!session.canManage) {
    return NextResponse.json(
      { error: "Running the AI Discovery Engine requires the “Import data & run connectors” permission." },
      { status: 403 }
    );
  }

  const limit = await checkRateLimit(`ai-discovery:${session.email}`, WINDOW_MS, MAX_RUNS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const config = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({ where: { slug: config.slug } });
  if (!destination) {
    return NextResponse.json({ error: "Destination not seeded." }, { status: 500 });
  }

  const result = await runAIDiscovery(destination.id, destination.name);
  return NextResponse.json(result);
}
