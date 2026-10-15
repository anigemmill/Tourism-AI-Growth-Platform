"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, type ActionState } from "@/lib/forms";

const METRIC = z.enum([
  "QUALIFIED_ENQUIRIES", "BOOKING_CONVERSION", "BOOKING_VALUE", "ATTRIBUTABLE_REVENUE", "GUEST_NIGHTS", "TIME_SAVED_HOURS",
  "COST_PER_BOOKING", "AI_SEARCH_VISIBILITY", "REFERRAL_TRAFFIC", "GUEST_SATISFACTION", "TOTAL_BOOKINGS", "OTHER",
]);
const EVIDENCE = z.enum(["OBSERVED", "OPERATOR_REPORTED", "MEASURED", "THIRD_PARTY", "HYPOTHESIS"]);

const rowSchema = z.object({
  metric: METRIC,
  label: f.optStr(),
  kind: z.enum(["BASELINE", "RESULT"]),
  value: z.coerce.number().finite(),
  unit: f.str(),
  periodStart: f.date(),
  periodEnd: f.date(),
  source: f.str(),
  evidenceKind: EVIDENCE.default("OPERATOR_REPORTED"),
  notes: f.optStr(),
});

export async function addMeasurement(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("results.edit");
  const parsed = parseForm(rowSchema.extend({ operatorId: f.str(), experimentId: f.optId() }), fd);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  if (d.periodEnd < d.periodStart) return { error: "Period end is before period start." };
  if (d.metric === "OTHER" && !d.label) return { error: "Describe the metric when choosing Other." };
  return guarded(async () => {
    const m = await prisma.measurement.create({
      data: { ...d, label: d.label ?? null, notes: d.notes ?? null, experimentId: d.experimentId ?? null, recordedBy: user.name },
    });
    await audit(user.id, "create", "measurement", m.id, `${d.kind} ${d.metric} = ${d.value} ${d.unit}`);
    revalidatePath("/results");
    revalidatePath(`/operators/${d.operatorId}`);
    return { ok: "Measurement recorded" };
  });
}

/**
 * Authorised CSV import for one operator. Header:
 * metric,kind,value,unit,periodStart,periodEnd,source[,label,evidenceKind,notes]
 * All-or-nothing: any invalid row rejects the whole import with line numbers.
 */
export async function importMeasurements(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("results.edit");
  const operatorId = String(fd.get("operatorId") ?? "");
  const csv = String(fd.get("csv") ?? "").trim();
  if (!operatorId) return { error: "Choose the operator this data belongs to." };
  if (!fd.get("authorised")) return { error: "Confirm the operator has authorised this data to be imported." };
  if (!csv) return { error: "Paste CSV data." };
  const parsedCsv = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (parsedCsv.errors.length) return { error: `CSV error on row ${(parsedCsv.errors[0].row ?? 0) + 2}: ${parsedCsv.errors[0].message}` };
  if (parsedCsv.data.length > 2000) return { error: "Maximum 2,000 rows per import." };
  const errors: string[] = [];
  const rows: z.infer<typeof rowSchema>[] = [];
  parsedCsv.data.forEach((raw, i) => {
    const r = rowSchema.safeParse({ ...raw, metric: raw.metric?.trim().toUpperCase(), kind: raw.kind?.trim().toUpperCase(), evidenceKind: raw.evidenceKind?.trim().toUpperCase() || undefined });
    if (!r.success) errors.push(`line ${i + 2}: ${r.error.issues[0].path.join(".")} — ${r.error.issues[0].message}`);
    else rows.push(r.data);
  });
  if (errors.length) return { error: `Nothing imported. ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ""}` };
  return guarded(async () => {
    await prisma.measurement.createMany({
      data: rows.map((r) => ({ ...r, label: r.label ?? null, notes: r.notes ?? null, operatorId, recordedBy: `${user.name} (CSV import)` })),
    });
    await audit(user.id, "import", "measurement", operatorId, `Imported ${rows.length} measurements`);
    revalidatePath("/results");
    return { ok: `Imported ${rows.length} measurement${rows.length === 1 ? "" : "s"}.` };
  });
}
