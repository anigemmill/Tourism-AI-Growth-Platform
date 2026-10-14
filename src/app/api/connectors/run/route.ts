import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { connectors } from "@/lib/connectors";
import { getActiveDestinationConfig } from "@/config/destinations";
import { checkRateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 10 * 60_000;
const MAX_RUNS = 10;

export async function POST() {
  const session = await getSession();
  if (session.role !== "PARTNER" && session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Running connectors requires a PARTNER or ADMIN session." },
      { status: 403 }
    );
  }

  const limit = await checkRateLimit(`connectors-run:${session.email}`, WINDOW_MS, MAX_RUNS);
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

  const ctx = {
    destinationId: destination.id,
    destinationSlug: destination.slug,
    lat: destination.lat,
    lng: destination.lng,
  };

  const results = [];
  for (const connector of connectors) {
    const result = await connector.run(ctx);
    results.push({ connector: connector.name, ...result });
  }

  return NextResponse.json({ results });
}
