import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const reviewSchema = z.object({
  mentionPosition: z.number().int().positive().nullable().optional(),
  experiencesRecommended: z.array(z.string()).optional(),
  competitorsMentioned: z.array(z.string()).optional(),
  citedSources: z.array(z.string()).optional(),
  factualIssues: z.array(z.string()).optional(),
});

// A human review pass over a stored AIVisibilityCheck — the brief requires
// factual-issue tracking to be real, not auto-guessed (see
// src/lib/engine/ai-discovery.ts).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.canManage) {
    return NextResponse.json(
      { error: "Reviewing AI Discovery checks requires the “Import data & run connectors” permission." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = reviewSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid review payload", issues: body.error.issues }, { status: 400 });
  }

  const updated = await prisma.aIVisibilityCheck.update({
    where: { id },
    data: body.data,
  });

  return NextResponse.json(updated);
}
