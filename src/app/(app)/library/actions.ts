"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit, diff } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, nullify, type ActionState } from "@/lib/forms";

const schema = z.object({
  name: f.str(),
  kind: z.enum(["CONCEPT_SPEC", "PROMPT_TEMPLATE", "AUTOMATED_WORKFLOW", "AGENT"]),
  status: z.enum(["CONCEPT", "TESTING", "VALIDATED", "OPERATIONAL", "RETIRED"]),
  purpose: f.str(),
  problem: f.optStr(),
  intendedUser: f.optStr(),
  inputs: f.optStr(),
  expectedOutput: f.optStr(),
  tools: f.list(),
  permissions: f.optStr(),
  humanApproval: f.optStr(),
  costNotes: f.optStr(),
  limitations: f.optStr(),
  testResults: f.optStr(),
  evidenceOfValue: f.optStr(),
  culturalReview: z.enum(["NOT_APPLICABLE", "REQUIRED", "APPROVED"]),
  strategicInitiative: f.optStr(),
});

/** Status claims must be earned: validated/operational need recorded tests. */
function statusRule(d: z.infer<typeof schema>): string | null {
  if ((d.status === "VALIDATED" || d.status === "OPERATIONAL") && !d.testResults) {
    return "Record test results before marking a workflow validated or operational.";
  }
  if (d.status === "OPERATIONAL" && !d.humanApproval) return "Operational workflows must state their human-approval requirement.";
  if (d.kind === "AGENT" && d.status === "OPERATIONAL" && !d.evidenceOfValue) return "Record evidence of value before calling an agent operational.";
  return null;
}

export async function createAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("library.edit");
  const parsed = parseForm(schema.extend({ instructions: f.str() }), fd);
  if (parsed.error) return parsed.error;
  const err = statusRule(parsed.data);
  if (err) return { error: err };
  let id = "";
  const res = await guarded(async () => {
    const { instructions, ...rest } = parsed.data;
    const a = await prisma.workflowAsset.create({
      data: { ...(nullify(rest) as object), versions: { create: { version: 1, instructions, changeNote: "Initial version", createdBy: user.name } } } as never,
    });
    id = a.id;
    await audit(user.id, "create", "workflow", a.id, `Library: ${a.name}`);
    return { ok: "Created" };
  });
  if (res?.error) return res;
  redirect(`/library/${id}`);
}

export async function updateAsset(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("library.edit");
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  const err = statusRule(parsed.data);
  if (err) return { error: err };
  return guarded(async () => {
    const before = await prisma.workflowAsset.findUniqueOrThrow({ where: { id } });
    const data = nullify(parsed.data);
    await prisma.workflowAsset.update({ where: { id }, data: data as never });
    await audit(user.id, "update", "workflow", id, `Updated ${data.name}${before.status !== data.status ? ` (${before.status} → ${data.status})` : ""}`, diff(before, data));
    revalidatePath(`/library/${id}`);
    return { ok: "Saved" };
  });
}

export async function addVersion(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("library.edit");
  const parsed = parseForm(z.object({ instructions: f.str(), changeNote: f.str() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const a = await prisma.workflowAsset.findUniqueOrThrow({ where: { id } });
    const version = a.currentVersion + 1;
    await prisma.$transaction([
      prisma.workflowVersion.create({ data: { assetId: id, version, instructions: parsed.data.instructions, changeNote: parsed.data.changeNote, createdBy: user.name } }),
      prisma.workflowAsset.update({ where: { id }, data: { currentVersion: version } }),
    ]);
    await audit(user.id, "version", "workflow", id, `${a.name} v${version}: ${parsed.data.changeNote}`);
    revalidatePath(`/library/${id}`);
    return { ok: `Saved as v${version}` };
  });
}

export async function setUsage(assetId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("library.edit");
  const parsed = parseForm(z.object({ operatorId: f.str(), status: z.enum(["piloting", "in use", "stopped"]), notes: f.optStr() }), fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const { operatorId, status, notes } = parsed.data;
    await prisma.workflowUsage.upsert({
      where: { assetId_operatorId: { assetId, operatorId } },
      update: { status, notes: notes ?? null },
      create: { assetId, operatorId, status, notes: notes ?? null },
    });
    await audit(user.id, "update", "workflow.usage", assetId, `Usage ${status}`);
    revalidatePath(`/library/${assetId}`);
    return { ok: "Usage saved" };
  });
}
