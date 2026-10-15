"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { visibilityChangeError } from "@/lib/authz";
import { f, parseForm, type ActionState } from "@/lib/forms";
import { buildBrief } from "@/lib/domain/brief";
import { definitionFor } from "@/lib/integrations/registry";
import { callClaude, isLLMConfigured } from "@/lib/llm/anthropic";

const CLAIM = z.enum(["FACT", "OBSERVATION", "INFERENCE", "HYPOTHESIS", "RECOMMENDATION"]);

const signalSchema = z.object({
  type: f.str(),
  title: f.str(),
  summary: f.str(),
  claimType: CLAIM,
  source: f.str(),
  sourceTimestamp: f.date(),
  evidence: f.optStr(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  momentum: f.optStr(),
  commercialPotential: f.optStr(),
  visibility: z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]),
  competitorId: f.optId(),
});

export async function addSignal(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(signalSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId } });
    const err = visibilityChangeError(parsed.data.visibility, op);
    if (err) return { error: err };
    const d = parsed.data;
    if (d.competitorId) {
      const c = await prisma.competitor.findUnique({ where: { id: d.competitorId } });
      if (!c || c.operatorId !== operatorId) return { error: "Competitor does not belong to this operator." };
    }
    const s = await prisma.signal.create({
      data: {
        ...d, operatorId, evidence: d.evidence ?? null, momentum: d.momentum ?? null,
        commercialPotential: d.commercialPotential ?? null, competitorId: d.competitorId ?? null, createdBy: user.name,
      },
    });
    await audit(user.id, "create", "signal", s.id, `Signal: ${s.title}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Signal recorded" };
  });
}

export async function setIntegration(operatorId: string, sourceKey: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  if (!definitionFor(sourceKey)) return { error: "Unknown source" };
  const parsed = parseForm(
    z.object({
      status: z.enum(["CONNECTED", "NOT_CONNECTED", "MANUAL_IMPORT", "REQUIRES_API", "REQUIRES_USER_AUTH"]),
      notes: f.optStr(),
      lastSyncedAt: f.optDate(),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  if (parsed.data.status === "CONNECTED" && !parsed.data.lastSyncedAt) {
    return { error: "Only mark a source Connected after a successful tested sync — record its date." };
  }
  return guarded(async () => {
    const data = { status: parsed.data.status, notes: parsed.data.notes ?? null, lastSyncedAt: parsed.data.lastSyncedAt ?? null };
    await prisma.integrationConnection.upsert({
      where: { operatorId_sourceKey: { operatorId, sourceKey } },
      update: data,
      create: { operatorId, sourceKey, ...data },
    });
    await audit(user.id, "update", "integration", operatorId, `${sourceKey} → ${data.status}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Saved" };
  });
}

/** Builds a DRAFT brief deterministically from stored data. */
export async function generateBrief(operatorId: string): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  return guarded(async () => {
    const weekOf = new Date();
    const [signals, opportunities, tasks, experiments, baselineCount] = await Promise.all([
      prisma.signal.findMany({ where: { operatorId } }),
      prisma.opportunity.findMany({ where: { operatorId } }),
      prisma.task.findMany({ where: { operatorId }, include: { assignee: { select: { name: true } } } }),
      prisma.experiment.findMany({ where: { operatorId } }),
      prisma.measurement.count({ where: { operatorId, kind: "BASELINE" } }),
    ]);
    const draft = buildBrief({
      weekOf,
      signals,
      opportunities,
      tasks: tasks.map((t) => ({ ...t, assigneeName: t.assignee?.name ?? null })),
      experiments,
      hasBaseline: baselineCount > 0,
    });
    const b = await prisma.growthBrief.create({
      data: {
        operatorId, weekOf, whatChanged: draft.whatChanged, whyItMatters: draft.whyItMatters, actions: draft.actions as never,
        learnings: draft.learnings, dataGaps: draft.dataGaps, generatedBy: "rules", createdBy: user.name,
      },
    });
    await audit(user.id, "create", "brief", b.id, "Generated draft weekly brief");
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Draft brief generated — review before approving" };
  });
}

export async function reviewBrief(briefId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(
    z.object({ whyItMatters: f.optStr(), learnings: f.optStr(), status: z.enum(["DRAFT", "APPROVED", "SHARED"]) }),
    fd
  );
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const b = await prisma.growthBrief.findUniqueOrThrow({ where: { id: briefId } });
    const approving = parsed.data.status !== "DRAFT" && b.status === "DRAFT";
    await prisma.growthBrief.update({
      where: { id: briefId },
      data: {
        whyItMatters: parsed.data.whyItMatters ?? null,
        learnings: parsed.data.learnings ?? null,
        status: parsed.data.status,
        ...(approving ? { approvedBy: user.name, approvedAt: new Date() } : {}),
        ...(parsed.data.status === "DRAFT" ? { approvedBy: null, approvedAt: null } : {}),
      },
    });
    await audit(user.id, "update", "brief", briefId, `Brief → ${parsed.data.status}`);
    revalidatePath(`/operators/${b.operatorId}/intelligence`);
    return { ok: parsed.data.status === "SHARED" ? "Shared with operator" : "Saved" };
  });
}

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

const competitorSchema = z.object({
  name: f.str(),
  websiteUrl: f.url(),
  notes: f.optStr(),
});

export async function addCompetitor(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(competitorSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const d = parsed.data;
    const c = await prisma.competitor.create({
      data: { operatorId, name: d.name, websiteUrl: d.websiteUrl ?? null, notes: d.notes ?? null, createdBy: user.name },
    });
    await audit(user.id, "create", "competitor", c.id, `Competitor: ${c.name}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Competitor added" };
  });
}

export async function removeCompetitor(operatorId: string, competitorId: string): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  return guarded(async () => {
    const c = await prisma.competitor.findUniqueOrThrow({ where: { id: competitorId } });
    if (c.operatorId !== operatorId) return { error: "Competitor does not belong to this operator." };
    await prisma.competitor.delete({ where: { id: competitorId } });
    await audit(user.id, "delete", "competitor", competitorId, `Removed competitor: ${c.name}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Competitor removed" };
  });
}

// ---------------------------------------------------------------------------
// Content briefs
// ---------------------------------------------------------------------------

const CONTENT_TYPE = z.enum(["LANDING_PAGE", "BLOG", "DESTINATION_GUIDE", "FAQ", "SOCIAL_POST", "VIDEO", "EMAIL", "PR", "COMPARISON", "ITINERARY"]);

const contentBriefSchema = z.object({
  contentType: CONTENT_TYPE,
  title: f.str(),
  whyNow: f.str(),
  targetAudience: f.str(),
  keyPoints: f.list(),
  seoNotes: f.optStr(),
  aiDiscoveryNotes: f.optStr(),
});

export async function addContentBrief(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  const parsed = parseForm(contentBriefSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const d = parsed.data;
    const b = await prisma.contentBrief.create({
      data: {
        operatorId, contentType: d.contentType, title: d.title, whyNow: d.whyNow, targetAudience: d.targetAudience,
        keyPoints: d.keyPoints, seoNotes: d.seoNotes ?? null, aiDiscoveryNotes: d.aiDiscoveryNotes ?? null, createdBy: user.name,
      },
    });
    await audit(user.id, "create", "contentBrief", b.id, `Content brief: ${b.title}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Content brief proposed" };
  });
}

const CONTENT_BRIEF_TRANSITIONS: Record<string, string[]> = {
  PROPOSED: ["APPROVED", "REJECTED"],
  APPROVED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["PUBLISHED", "REJECTED"],
  PUBLISHED: [],
  REJECTED: [],
};

export async function transitionContentBrief(operatorId: string, briefId: string, nextStatus: string): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  return guarded(async () => {
    const b = await prisma.contentBrief.findUniqueOrThrow({ where: { id: briefId } });
    if (b.operatorId !== operatorId) return { error: "Content brief does not belong to this operator." };
    const allowed = CONTENT_BRIEF_TRANSITIONS[b.status] ?? [];
    if (!allowed.includes(nextStatus)) return { error: `Cannot move a content brief from ${b.status} to ${nextStatus}.` };
    const approving = nextStatus === "APPROVED";
    await prisma.contentBrief.update({
      where: { id: briefId },
      data: {
        status: nextStatus as never,
        ...(approving ? { approvedBy: user.name, approvedAt: new Date() } : {}),
      },
    });
    await audit(user.id, "update", "contentBrief", briefId, `Content brief "${b.title}" → ${nextStatus}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Saved" };
  });
}

// ---------------------------------------------------------------------------
// LLM website analysis (ported from TGI). Gated on ANTHROPIC_API_KEY; never
// invents a profile when the key is absent — the Growth OS core makes no LLM
// calls, so this stays an explicit, operator-triggered, clearly-labelled
// exception, consistent with destination's Scenario/AI Discovery engines.
// ---------------------------------------------------------------------------

const PROFILE_RESULT = z.object({
  positioning: f.str(),
  differentiators: z.array(z.string()).max(10).default([]),
  pricingSummary: f.optStr(),
  experiencesSummary: f.optStr(),
  seasonalitySummary: f.optStr(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).max(10).default([]),
  bookingProcessSummary: f.optStr(),
  currentContentSummary: f.optStr(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

async function fetchSiteText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "TourismAIGrowthOS/1.0 (+website analysis)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object found in model response.");
  return JSON.parse(text.slice(start, end + 1));
}

export async function analyzeOperatorWebsite(operatorId: string): Promise<ActionState> {
  const user = await requirePermission("operators.edit");
  return guarded(async () => {
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId } });
    if (!op.websiteUrl) return { error: "Add a website URL to the operator's profile before analysing it." };

    if (!isLLMConfigured()) {
      await prisma.operatorProfile.upsert({
        where: { operatorId },
        update: { analysisStatus: "REQUIRES_API", analysisError: null },
        create: { operatorId, analysisStatus: "REQUIRES_API" },
      });
      revalidatePath(`/operators/${operatorId}/intelligence`);
      return { error: "ANTHROPIC_API_KEY is not configured — nothing was analysed or invented." };
    }

    let siteText: string;
    try {
      siteText = await fetchSiteText(op.websiteUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not fetch the website.";
      await prisma.operatorProfile.upsert({
        where: { operatorId },
        update: { analysisStatus: "FAILED", analysisError: message },
        create: { operatorId, analysisStatus: "FAILED", analysisError: message },
      });
      revalidatePath(`/operators/${operatorId}/intelligence`);
      return { error: `Could not fetch the website: ${message}` };
    }

    let profile: z.infer<typeof PROFILE_RESULT>;
    try {
      const raw = await callClaude({
        system:
          "You extract a factual business profile for a tourism operator from their own website text. " +
          "Only report what the text actually supports — omit a field rather than guessing, and set confidence honestly " +
          "(LOW if the page is thin or generic). Respond with ONLY a single JSON object matching this shape, no prose: " +
          '{"positioning": string, "differentiators": string[], "pricingSummary": string|null, "experiencesSummary": string|null, ' +
          '"seasonalitySummary": string|null, "faqs": [{"question": string, "answer": string}], ' +
          '"bookingProcessSummary": string|null, "currentContentSummary": string, "confidence": "LOW"|"MEDIUM"|"HIGH"}',
        userMessage: `Website: ${op.websiteUrl}\n\nPage text:\n${siteText}`,
        maxTokens: 1500,
      });
      profile = PROFILE_RESULT.parse(extractJsonObject(raw));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      await prisma.operatorProfile.upsert({
        where: { operatorId },
        update: { analysisStatus: "FAILED", analysisError: message },
        create: { operatorId, analysisStatus: "FAILED", analysisError: message },
      });
      revalidatePath(`/operators/${operatorId}/intelligence`);
      return { error: `Analysis failed: ${message}` };
    }

    await prisma.operatorProfile.upsert({
      where: { operatorId },
      update: {
        positioning: profile.positioning,
        differentiators: profile.differentiators,
        pricingSummary: profile.pricingSummary ?? null,
        experiencesSummary: profile.experiencesSummary ?? null,
        seasonalitySummary: profile.seasonalitySummary ?? null,
        faqs: profile.faqs,
        bookingProcessSummary: profile.bookingProcessSummary ?? null,
        currentContentSummary: profile.currentContentSummary ?? null,
        analysisStatus: "CONNECTED",
        analysisError: null,
        analysisConfidence: profile.confidence,
        analyzedAt: new Date(),
        analyzedBy: user.name,
      },
      create: {
        operatorId,
        positioning: profile.positioning,
        differentiators: profile.differentiators,
        pricingSummary: profile.pricingSummary ?? null,
        experiencesSummary: profile.experiencesSummary ?? null,
        seasonalitySummary: profile.seasonalitySummary ?? null,
        faqs: profile.faqs,
        bookingProcessSummary: profile.bookingProcessSummary ?? null,
        currentContentSummary: profile.currentContentSummary ?? null,
        analysisStatus: "CONNECTED",
        analysisConfidence: profile.confidence,
        analyzedAt: new Date(),
        analyzedBy: user.name,
      },
    });
    await audit(user.id, "update", "operatorProfile", operatorId, "Ran LLM website analysis");
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Website analysed" };
  });
}
