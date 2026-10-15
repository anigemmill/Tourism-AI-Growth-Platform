import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AccessLevel, Confidence } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { runImport } from "@/lib/import/importer";
import { IMPORT_TARGETS, type ImportTargetTable } from "@/lib/import/schemas";
import { getActiveDestinationConfig } from "@/config/destinations";

const metaSchema = z.object({
  targetTable: z.enum(
    Object.keys(IMPORT_TARGETS) as [ImportTargetTable, ...ImportTargetTable[]]
  ),
  dataSourceName: z.string().min(1),
  dataSourceOrganisation: z.string().min(1),
  geography: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  confidence: z.enum(["VERIFIED", "HIGH", "MEDIUM", "LOW", "MODELLED"]),
  accessLevel: z.enum([
    "PUBLIC",
    "PARTNER",
    "PRIVATE_BUSINESS",
    "AGGREGATED",
    "MODEL_INFERENCE",
  ]),
  notes: z.string().optional(),
});

// Manual data import is a partner/admin action — never PUBLIC. See
// docs/ARCHITECTURE.md §6.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.canManage) {
    return NextResponse.json(
      { error: "Importing data requires the “Import data & run connectors” permission." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
  }

  const metaRaw = {
    targetTable: formData.get("targetTable"),
    dataSourceName: formData.get("dataSourceName"),
    dataSourceOrganisation: formData.get("dataSourceOrganisation"),
    geography: formData.get("geography"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    confidence: formData.get("confidence"),
    accessLevel: formData.get("accessLevel"),
    notes: formData.get("notes") ?? undefined,
  };

  const meta = metaSchema.safeParse(metaRaw);
  if (!meta.success) {
    return NextResponse.json(
      { error: "Invalid import metadata", issues: meta.error.issues },
      { status: 400 }
    );
  }

  const destinationConfig = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({
    where: { slug: destinationConfig.slug },
  });
  if (!destination) {
    return NextResponse.json(
      { error: "Destination not seeded — run the seed script first." },
      { status: 500 }
    );
  }

  const csvText = await file.text();

  try {
    const result = await runImport({
      destinationId: destination.id,
      targetTable: meta.data.targetTable,
      csvText,
      fileName: file.name,
      uploadedBy: session.email ?? "dev-session",
      dataSourceName: meta.data.dataSourceName,
      dataSourceOrganisation: meta.data.dataSourceOrganisation,
      geography: meta.data.geography,
      periodStart: new Date(meta.data.periodStart),
      periodEnd: new Date(meta.data.periodEnd),
      confidence: meta.data.confidence as Confidence,
      accessLevel: meta.data.accessLevel as AccessLevel,
      notes: meta.data.notes,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 }
    );
  }
}
