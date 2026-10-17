// Server-side authorisation rules for the Growth OS (docs/GROWTH_OS.md §Access).
//
// Pure functions only — no request APIs — so they are unit-testable and
// reusable from server components, server actions and route handlers.
// Every query that returns operator-owned data must go through
// `scopedWhere` (or an explicit equivalent) for OPERATOR users.

import type { UserRole, Visibility } from "@/generated/prisma";
import { ROLE_SCOPE } from "@/lib/rbac/permissions";

export interface Actor {
  id: string;
  role: UserRole;
  operatorId: string | null;
}

export const SHARED_VISIBILITIES: Visibility[] = ["COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"];

/** Staff roles see programme data across businesses; what they may do with
 * it is governed by permissions (src/lib/rbac). Operators are tenant-scoped. */
export function isStaffRole(role: UserRole): boolean {
  return ROLE_SCOPE[role] === "staff";
}

export interface RecordAccessInfo {
  operatorId: string | null;
  visibility: Visibility;
  /** operator ids participating in the record's shared initiative, if any */
  initiativeOperatorIds?: string[];
}

/** May this actor read this record? */
export function canViewRecord(actor: Actor, record: RecordAccessInfo): boolean {
  if (isStaffRole(actor.role)) return true;
  if (!actor.operatorId) return false;
  if (record.visibility === "INTERNAL") return false;
  if (SHARED_VISIBILITIES.includes(record.visibility)) return true;
  if (record.operatorId === actor.operatorId) return true;
  return record.initiativeOperatorIds?.includes(actor.operatorId) ?? false;
}

/**
 * Prisma `where` fragment restricting a model that has `operatorId` +
 * `visibility` (and optionally an `initiative` relation) to what the actor
 * may read. Staff get an empty filter. An operator with no linked business
 * gets an impossible filter rather than everything.
 */
export function scopedWhere(actor: Actor, opts: { hasInitiative?: boolean } = {}) {
  if (isStaffRole(actor.role)) return {};
  if (!actor.operatorId) return { id: "__none__" };
  const or: Record<string, unknown>[] = [
    { operatorId: actor.operatorId, visibility: { not: "INTERNAL" as Visibility } },
    { visibility: { in: SHARED_VISIBILITIES } },
  ];
  if (opts.hasInitiative) {
    or.push({
      visibility: { not: "INTERNAL" as Visibility },
      initiative: { participants: { some: { operatorId: actor.operatorId } } },
    });
  }
  return { OR: or };
}

/**
 * Operator-owned records (with `operatorId`, `visibility`, `operator` and
 * `initiative` relations) that a client business may read in its portal,
 * honouring what each owner consented to:
 *   - its own records (not INTERNAL), and its shared initiatives' records;
 *   - COHORT: only from businesses in the same programme (cohort), or with no
 *     owning business, and only when the viewer is itself in a programme;
 *   - PUBLIC_APPROVED: from anyone (approved for a public case study);
 *   - AGGREGATE_APPROVED: never item by item (anonymised totals only).
 * Staff get an empty filter; an operator with no business gets nothing.
 */
export function sharedWithBusinessWhere(actor: Actor, viewerProgrammeId: string | null) {
  if (isStaffRole(actor.role)) return {};
  if (!actor.operatorId) return { id: "__none__" };
  const or: Record<string, unknown>[] = [
    { operatorId: actor.operatorId, visibility: { not: "INTERNAL" as Visibility } },
    { visibility: { not: "INTERNAL" as Visibility }, initiative: { participants: { some: { operatorId: actor.operatorId } } } },
    { visibility: "PUBLIC_APPROVED" as Visibility },
  ];
  if (viewerProgrammeId) {
    or.push({ visibility: "COHORT" as Visibility, OR: [{ operatorId: null }, { operator: { programmeId: viewerProgrammeId } }] });
  }
  return { OR: or };
}

/** A business's own records plus its shared initiatives' records (never other businesses'). */
export function ownOrInitiativeWhere(actor: Actor) {
  if (isStaffRole(actor.role)) return {};
  if (!actor.operatorId) return { id: "__none__" };
  return {
    visibility: { not: "INTERNAL" as Visibility },
    OR: [{ operatorId: actor.operatorId }, { initiative: { participants: { some: { operatorId: actor.operatorId } } } }],
  };
}

/** Records that must only ever be seen by their owner + staff (e.g. tasks). */
export function ownedOnlyWhere(actor: Actor) {
  if (isStaffRole(actor.role)) return {};
  if (!actor.operatorId) return { id: "__none__" };
  return { operatorId: actor.operatorId, visibility: { not: "INTERNAL" as Visibility } };
}

export interface ConsentState {
  consentCohortSharing: boolean;
  consentAggregate: boolean;
  consentCaseStudy: boolean;
}

/**
 * Governance gate for widening who can see operator-sourced content.
 * Returns an error message when the change is not permitted, else null.
 * This is a workflow control, not proof of legal compliance.
 */
export function visibilityChangeError(
  target: Visibility,
  operator: ConsentState | null,
  culturalReview: "NOT_APPLICABLE" | "REQUIRED" | "APPROVED" = "NOT_APPLICABLE"
): string | null {
  if (target === "INTERNAL" || target === "CONFIDENTIAL") return null;
  if (culturalReview === "REQUIRED") {
    return "Cultural review is required before this can be shared beyond the operator. Record the approving authority first.";
  }
  if (!operator) return null; // programme-authored content with no operator source
  if (target === "COHORT" && !operator.consentCohortSharing) {
    return "The operator has not consented to sharing with the cohort.";
  }
  if (target === "AGGREGATE_APPROVED" && !operator.consentAggregate) {
    return "The operator has not consented to anonymised aggregate reporting.";
  }
  if (target === "PUBLIC_APPROVED" && !operator.consentCaseStudy) {
    return "The operator has not consented to public case-study use.";
  }
  return null;
}
