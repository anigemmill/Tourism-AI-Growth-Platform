import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { answerScenario } from "@/lib/engine/scenario";
import { getActiveDestinationConfig } from "@/config/destinations";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ question: z.string().min(3).max(500) });
const WINDOW_MS = 10 * 60_000;
const MAX_QUERIES = 20;

export async function GET() {
  const session = await getSession();
  if (session.role !== "ADMIN" && session.role !== "PARTNER") {
    return NextResponse.json(
      { error: "The Scenario Engine is available to programme staff only." },
      { status: 403 }
    );
  }
  const config = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({ where: { slug: config.slug } });
  if (!destination) return NextResponse.json({ queries: [] });

  const queries = await prisma.scenarioQuery.findMany({
    where: { destinationId: destination.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ queries });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN" && session.role !== "PARTNER") {
    return NextResponse.json(
      { error: "The Scenario Engine is available to programme staff only." },
      { status: 403 }
    );
  }

  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid question", issues: body.error.issues }, { status: 400 });
  }

  const limit = await checkRateLimit(`scenario:${session.email}`, WINDOW_MS, MAX_QUERIES);
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

  const answer = await answerScenario(destination.id, body.data.question);

  const saved = await prisma.scenarioQuery.create({
    data: {
      destinationId: destination.id,
      question: body.data.question,
      askedBy: session.email ?? session.role,
      facts: answer.facts,
      evidence: answer.evidence,
      inferences: answer.inferences,
      hypotheses: answer.hypotheses,
      recommendations: answer.recommendations,
      insufficientData: answer.insufficientData,
      llmAssisted: answer.llmAssisted,
    },
  });

  return NextResponse.json(saved);
}
