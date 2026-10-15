"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssessmentArea } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, type ActionState } from "@/lib/forms";

const headerSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "COMPLETE"]),
  summary: f.optStr(),
  sharedWithOperator: f.bool(),
});
const areaSchema = z.object({ score: f.optInt(1, 5), observed: f.optStr(), reported: f.optStr(), notes: f.optStr() });

export async function saveAssessment(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("assessments.edit");
  const header = headerSchema.safeParse({
    status: fd.get("status"),
    summary: fd.get("summary"),
    sharedWithOperator: fd.get("sharedWithOperator"),
  });
  if (!header.success) return { error: header.error.issues[0].message };

  return guarded(async () => {
    const a = await prisma.assessment.findUniqueOrThrow({ where: { id }, include: { areas: true } });
    if (header.data.status === "COMPLETE" && a.areas.some((ar) => fd.get(`${ar.area}.score`) === "")) {
      return { error: "Score every area (or mark it not started) before completing the assessment." };
    }
    await prisma.$transaction([
      prisma.assessment.update({
        where: { id },
        data: { status: header.data.status, summary: header.data.summary ?? null, sharedWithOperator: header.data.sharedWithOperator },
      }),
      ...a.areas.map((ar) => {
        const p = areaSchema.parse({
          score: fd.get(`${ar.area}.score`),
          observed: fd.get(`${ar.area}.observed`),
          reported: fd.get(`${ar.area}.reported`),
          notes: fd.get(`${ar.area}.notes`),
        });
        return prisma.assessmentAreaScore.update({
          where: { assessmentId_area: { assessmentId: id, area: ar.area as AssessmentArea } },
          data: { score: p.score ?? null, observed: p.observed ?? null, reported: p.reported ?? null, notes: p.notes ?? null },
        });
      }),
    ]);
    await audit(user.id, "update", "assessment", id, `Saved assessment (${header.data.status})`);
    revalidatePath(`/assessments/${id}`);
    revalidatePath(`/operators/${a.operatorId}`);
    return { ok: "Assessment saved" };
  });
}
