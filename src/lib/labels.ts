// Human-readable labels for enum values. Single source for UI + exports.

import type {
  AssessmentArea, AssessmentStatus, ComparisonMethod, ConfidenceLevel, ContentBriefStatus, ContentType, CostCategory,
  CulturalReview, DealStage, DealType, Decision, EvidenceKind, ExperimentStatus, Horizon, MetricKey, OperatorStatus,
  OpportunityStatus, RiskKind, Severity, SolutionType, UserRole, Visibility, WorkStatus, WorkflowKind,
  WorkflowStatus,
} from "@/generated/prisma";

export const AREA_LABELS: Record<AssessmentArea, string> = {
  AI_SEARCH_VISIBILITY: "Website & AI search visibility",
  MARKETING_CONTENT: "Marketing & content production",
  ENQUIRIES_CONVERSION: "Enquiries & sales conversion",
  BOOKING_JOURNEY: "Booking journey & customer experience",
  GUEST_COMMUNICATIONS: "Guest communications",
  ADMIN_WORKLOAD: "Administrative workload",
  REPORTING_DECISIONS: "Reporting & decision-making",
  OPERATIONS: "Operations",
  FEEDBACK_PRODUCT: "Customer feedback & product development",
};

export const OPERATOR_STATUS_LABELS: Record<OperatorStatus, string> = {
  PROSPECT: "Prospect", INVITED: "Invited", ONBOARDING: "Onboarding", ACTIVE: "Active",
  PAUSED: "Paused", COMPLETED: "Completed", WITHDRAWN: "Withdrawn",
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  TODO: "To do", IN_PROGRESS: "In progress", BLOCKED: "Blocked", DONE: "Done", CANCELLED: "Cancelled",
};

export const HORIZON_LABELS: Record<Horizon, string> = { NOW: "Now", NEXT: "Next", LATER: "Later", IGNORE: "Ignore" };

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  OBSERVED: "Observed fact",
  OPERATOR_REPORTED: "Operator-reported",
  MEASURED: "Measured",
  THIRD_PARTY: "Third-party source",
  HYPOTHESIS: "Hypothesis",
};

export const SOLUTION_LABELS: Record<SolutionType, string> = {
  AI_ASSISTED: "AI-assisted",
  AUTOMATION: "Simple automation",
  PROCESS_CHANGE: "Process change",
  WEBSITE_CONTENT: "Website / listing info",
  TRAINING: "Training",
  OTHER: "Other",
};

export const OPP_STATUS_LABELS: Record<OpportunityStatus, string> = {
  IDENTIFIED: "Identified", PRIORITISED: "Prioritised", APPROVED: "Approved", IN_PROGRESS: "In progress",
  LIVE: "Live", MEASURING: "Measuring", CLOSED: "Closed", REJECTED: "Rejected",
};

export const DECISION_LABELS: Record<Decision, string> = {
  SCALE: "Scale", AMEND: "Amend", STOP: "Stop", INVESTIGATE: "Investigate further",
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  NOT_STARTED: "Not started", IN_PROGRESS: "In progress", IN_REVIEW: "In review", COMPLETE: "Complete",
};

export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  DESIGN: "Design", RUNNING: "Running", ANALYSING: "Analysing", COMPLETE: "Complete", ABANDONED: "Abandoned",
};

export const COMPARISON_LABELS: Record<ComparisonMethod, string> = {
  BEFORE_AFTER: "Before / after",
  CONTROL_GROUP: "Control group",
  MATCHED_COMPARISON: "Matched comparison",
  NONE: "No comparison (descriptive only)",
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  QUALIFIED_ENQUIRIES: "Qualified enquiries",
  BOOKING_CONVERSION: "Booking conversion (%)",
  BOOKING_VALUE: "Average booking value (NZD)",
  ATTRIBUTABLE_REVENUE: "Attributable revenue (NZD)",
  GUEST_NIGHTS: "Guest nights",
  TIME_SAVED_HOURS: "Time saved (hours)",
  COST_PER_BOOKING: "Cost per booking (NZD)",
  AI_SEARCH_VISIBILITY: "AI-search visibility (% of tracked prompts)",
  REFERRAL_TRAFFIC: "Website referral traffic",
  GUEST_SATISFACTION: "Guest satisfaction",
  TOTAL_BOOKINGS: "Total bookings",
  OTHER: "Other",
};

/** Metrics where a lower number is the better outcome. */
export const LOWER_IS_BETTER: MetricKey[] = ["COST_PER_BOOKING"];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  INTERNAL: "Internal (staff only)",
  CONFIDENTIAL: "Confidential (operator + staff)",
  COHORT: "Shared with cohort",
  AGGREGATE_APPROVED: "Approved for anonymised aggregate",
  PUBLIC_APPROVED: "Approved for public case study",
};

export const CULTURAL_LABELS: Record<CulturalReview, string> = {
  NOT_APPLICABLE: "No cultural content",
  REQUIRED: "Cultural review required",
  APPROVED: "Cultural review approved",
};

export const WORKFLOW_KIND_LABELS: Record<WorkflowKind, string> = {
  CONCEPT_SPEC: "Concept / specification",
  PROMPT_TEMPLATE: "Prompt template",
  AUTOMATED_WORKFLOW: "Automated workflow",
  AGENT: "Functioning agent",
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  CONCEPT: "Concept", TESTING: "Testing", VALIDATED: "Validated", OPERATIONAL: "Operational", RETIRED: "Retired",
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  PARTICIPATION_FEE: "Participation fee",
  SPONSORSHIP: "Sponsorship",
  IMPLEMENTATION: "Implementation project",
  RECURRING_SERVICE: "Recurring intelligence service",
  LICENSING: "Licensing",
  OTHER: "Other",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  OPPORTUNITY: "Opportunity", PROPOSED: "Proposed", QUOTED: "Quoted", CONTRACTED: "Contracted", LOST: "Lost",
};

export const COST_LABELS: Record<CostCategory, string> = {
  DELIVERY_LABOUR: "Delivery labour", CONTRACTOR: "Contractor", SOFTWARE: "Software",
  TRAVEL: "Travel", VENUE: "Venue", OTHER: "Other",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  LANDING_PAGE: "Landing page",
  BLOG: "Blog post",
  DESTINATION_GUIDE: "Destination guide",
  FAQ: "FAQ",
  SOCIAL_POST: "Social post",
  VIDEO: "Video",
  EMAIL: "Email",
  PR: "PR",
  COMPARISON: "Comparison page",
  ITINERARY: "Itinerary",
};

export const CONTENT_BRIEF_STATUS_LABELS: Record<ContentBriefStatus, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
};

export const RISK_KIND_LABELS: Record<RiskKind, string> = { RISK: "Risk", BLOCKER: "Blocker", ISSUE: "Issue" };
export const SEVERITY_LABELS: Record<Severity, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
export const ROLE_LABELS: Record<UserRole, string> = { FOUNDER: "Founder", ADMIN: "Programme admin", OPERATOR: "Operator" };

export const OPERATOR_CATEGORIES = [
  "accommodation", "activity", "attraction", "cultural", "food-beverage", "transport", "wellness", "other",
];

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
