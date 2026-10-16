// Data access for OPERATOR users. Every query is scoped by the actor —
// never by an id taken from the request. Kept free of Next.js request APIs
// so access-control tests can call it directly.

import { prisma } from "@/lib/prisma";
import { ownedOnlyWhere, scopedWhere, SHARED_VISIBILITIES, type Actor } from "@/lib/authz";

function requireOperator(actor: Actor): string {
  if (actor.role !== "OPERATOR" || !actor.operatorId) throw new Error("Operator actor required");
  return actor.operatorId;
}

export async function portalBusiness(actor: Actor) {
  const operatorId = requireOperator(actor);
  return prisma.operator.findUniqueOrThrow({
    where: { id: operatorId },
    // internalNotes deliberately excluded
    select: {
      id: true, name: true, category: true, status: true, websiteUrl: true, bookingUrl: true, experiences: true,
      targetMarkets: true, marketingChannels: true, objectives: true, challenges: true, aiMaturity: true,
      agreedScope: true, dataAgreementSignedAt: true, consentCohortSharing: true, consentAggregate: true, consentCaseStudy: true,
      dataRetentionNotes: true, isSynthetic: true, programmeId: true, cohort: true,
      contactName: true, contactEmail: true, contactPhone: true, programme: { select: { name: true } },
    },
  });
}

export async function portalOpportunities(actor: Actor) {
  const operatorId = requireOperator(actor);
  // Roadmap = own business only (shared cohort items appear under Collective).
  return prisma.opportunity.findMany({ where: { operatorId, visibility: { not: "INTERNAL" } } });
}

export async function portalTasks(actor: Actor) {
  return prisma.task.findMany({
    where: ownedOnlyWhere(actor),
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
    include: { project: { select: { id: true, title: true } } },
  });
}

export async function portalProjects(actor: Actor) {
  return prisma.project.findMany({ where: ownedOnlyWhere(actor), orderBy: { createdAt: "desc" } });
}

export async function portalMeasurements(actor: Actor) {
  const operatorId = requireOperator(actor);
  return prisma.measurement.findMany({ where: { operatorId } });
}

export async function portalExperiments(actor: Actor) {
  return prisma.experiment.findMany({ where: scopedWhere(actor, { hasInitiative: true }), orderBy: { createdAt: "desc" } });
}

export async function portalAssessment(actor: Actor) {
  const operatorId = requireOperator(actor);
  return prisma.assessment.findFirst({
    where: { operatorId, sharedWithOperator: true },
    orderBy: { createdAt: "desc" },
    include: { areas: true },
  });
}

export async function portalBriefs(actor: Actor, take = 4) {
  const operatorId = requireOperator(actor);
  return prisma.growthBrief.findMany({ where: { operatorId, status: "SHARED" }, orderBy: { weekOf: "desc" }, take });
}

/** People linked to the operator's current business (read-only). */
export async function portalTeam(actor: Actor) {
  const operatorId = requireOperator(actor);
  const rows = await prisma.userBusiness.findMany({
    where: { operatorId, user: { status: { in: ["ACTIVE", "PENDING"] } } },
    orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
    // No credentials, tokens or other businesses' links.
    select: { isPrimaryContact: true, user: { select: { id: true, name: true, role: true, status: true, lastLoginAt: true } } },
  });
  return rows.map((r) => ({ ...r.user, isPrimaryContact: r.isPrimaryContact }));
}

/**
 * The operator's own subscriptions and invoices (read-only). Admin notes,
 * provider references and other businesses' records are never selected.
 */
export async function portalBilling(actor: Actor) {
  const operatorId = requireOperator(actor);
  const [subscriptions, invoices] = await Promise.all([
    prisma.subscription.findMany({
      where: { operatorId },
      orderBy: { createdAt: "desc" },
      select: { id: true, plan: true, status: true, interval: true, amountCents: true, currency: true, renewalDate: true, source: true },
    }),
    prisma.invoice.findMany({
      where: { operatorId, status: { not: "DRAFT" } },
      orderBy: { issuedAt: "desc" },
      take: 24,
      select: {
        id: true, number: true, status: true, amountCents: true, currency: true, issuedAt: true, dueAt: true, source: true,
        transactions: { select: { kind: true, status: true, amountCents: true, source: true } },
      },
    }),
  ]);
  return { subscriptions, invoices };
}

export async function portalLearnings(actor: Actor) {
  return prisma.learning.findMany({
    where: { ...scopedWhere(actor, { hasInitiative: true }), culturalReview: { not: "REQUIRED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, topic: true, isReusableProcess: true, visibility: true, operatorId: true, createdAt: true },
  });
}

export async function portalResources(actor: Actor) {
  requireOperator(actor);
  return prisma.resource.findMany({
    where: { visibility: { in: SHARED_VISIBILITIES }, culturalReview: { not: "REQUIRED" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function portalWorkshops(actor: Actor) {
  const operatorId = requireOperator(actor);
  const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { programmeId: true } });
  if (!op.programmeId) return [];
  // Agenda only — staff notes and other operators' attendance are not exposed.
  return prisma.workshop.findMany({
    where: { programmeId: op.programmeId },
    orderBy: { week: "asc" },
    select: { id: true, title: true, week: true, date: true, location: true, agenda: true, status: true, attendance: { where: { operatorId }, select: { attended: true } } },
  });
}

/** Cohort directory: public-facing business info only. */
export async function portalDirectory(actor: Actor) {
  const operatorId = requireOperator(actor);
  const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId }, select: { programmeId: true } });
  return prisma.operator.findMany({
    where: { programmeId: op.programmeId, status: { in: ["ACTIVE", "ONBOARDING", "COMPLETED"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, websiteUrl: true },
  });
}

export async function portalInitiatives(actor: Actor) {
  const operatorId = requireOperator(actor);
  return prisma.sharedInitiative.findMany({
    where: { participants: { some: { operatorId } }, visibility: { not: "INTERNAL" } },
    include: {
      participants: { select: { role: true, responsibilities: true, operator: { select: { name: true } } } },
      tasks: { where: { visibility: { not: "INTERNAL" } }, select: { id: true, title: true, status: true, dueDate: true, ownerLabel: true } },
    },
  });
}
