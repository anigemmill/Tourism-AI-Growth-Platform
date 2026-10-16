// Human-readable labels for enum values. Single source for UI + exports.

import type {
  AssessmentArea, AssessmentStatus, ComparisonMethod, ConfidenceLevel, ContentBriefStatus, ContentType, CostCategory,
  CulturalReview, DealStage, DealType, Decision, EvidenceKind, ExperimentStatus, Horizon, MetricKey, OperatorStatus,
  OpportunityStatus, RiskKind, Severity, SolutionType, UserRole, Visibility, WorkStatus, WorkflowKind,
  WorkflowStatus, UserStatus, BusinessAccountStatus, SubscriptionStatus, BillingInterval, InvoiceStatus, BillingTxnKind,
  BillingTxnStatus, BillingSource,
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
  INTERNAL: "Staff only (not shown to the business)",
  CONFIDENTIAL: "This business + staff",
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
export const ROLE_LABELS: Record<UserRole, string> = {
  FOUNDER: "Super Admin",
  ADMIN: "Platform Staff",
  PROGRAMME_MANAGER: "Programme Manager",
  ANALYST: "Read-only / Analyst",
  OPERATOR: "Tourism Operator",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  FOUNDER: "Everything, including users, roles, permissions, billing and commercial. Always holds every permission.",
  ADMIN: "Programme delivery, data import/export, audit log and the business directory. No user management, billing or commercial by default.",
  PROGRAMME_MANAGER: "Runs programme delivery: operators, assessments, opportunities, tasks, experiments and results.",
  ANALYST: "Reads programme data and reports. Cannot change anything.",
  OPERATOR: "Their own linked business(es) plus content shared with the cohort, through the operator portal.",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = { PENDING: "Invited", ACTIVE: "Active", SUSPENDED: "Suspended", ARCHIVED: "Deactivated" };

export const ACCOUNT_STATUS_LABELS: Record<BusinessAccountStatus, string> = { PENDING: "Pending", ACTIVE: "Active", SUSPENDED: "Suspended", ARCHIVED: "Archived" };

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "Trial", ACTIVE: "Active", PAST_DUE: "Past due", PAUSED: "Paused", CANCELLED: "Cancelled",
};

export const INTERVAL_LABELS: Record<BillingInterval, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual", ONE_OFF: "One-off" };

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { DRAFT: "Draft", OPEN: "Open", PAID: "Paid", VOID: "Void", UNCOLLECTIBLE: "Uncollectible" };

export const TXN_KIND_LABELS: Record<BillingTxnKind, string> = { PAYMENT: "Payment", REFUND: "Refund", CREDIT: "Credit adjustment", CHARGE: "Charge adjustment" };

export const TXN_STATUS_LABELS: Record<BillingTxnStatus, string> = { PENDING: "Pending", SUCCEEDED: "Succeeded", FAILED: "Failed" };

export const BILLING_SOURCE_LABELS: Record<BillingSource, string> = { MANUAL: "Manually recorded", PROVIDER: "Provider-confirmed" };

export const OPERATOR_CATEGORIES = [
  "accommodation", "activity", "attraction", "cultural", "food-beverage", "transport", "wellness", "other",
];

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
