// Growth OS seed.
//
// 1. Always: the programme skeleton (12-week programme, four stages,
//    milestones), solution templates and the agent & workflow library's
//    strategic records — structural data, not results.
// 2. Founder account from SEED_FOUNDER_EMAIL / SEED_FOUNDER_PASSWORD.
// 3. Only when SEED_DEMO=true: a SYNTHETIC cohort of 10 fictional operators
//    with illustrative assessments, measurements, experiments and commercial
//    figures. Every synthetic row is flagged (isSynthetic / isIllustrative)
//    and labelled in the UI. None of it describes a real business.

import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma";
import { hashPassword } from "../auth/password";
import { DEFAULT_STAGES } from "../domain/programme";

const DAY = 86_400_000;

function genPassword() {
  return randomBytes(12).toString("base64url");
}

export interface SeedOptions {
  founder?: { email: string; name?: string; password?: string };
  programmeStart?: Date;
  demo?: boolean;
  demoPassword?: string;
  quiet?: boolean;
}

/** Options from SEED_* environment variables (used by `npm run db:seed`). */
export function seedOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): SeedOptions {
  return {
    founder: env.SEED_FOUNDER_EMAIL ? { email: env.SEED_FOUNDER_EMAIL, name: env.SEED_FOUNDER_NAME, password: env.SEED_FOUNDER_PASSWORD } : undefined,
    programmeStart: env.SEED_PROGRAMME_START ? new Date(env.SEED_PROGRAMME_START) : undefined,
    demo: env.SEED_DEMO === "true",
    demoPassword: env.SEED_DEMO_PASSWORD || undefined,
  };
}

export async function seedGrowthOs(prisma: PrismaClient, opts: SeedOptions = seedOptionsFromEnv()) {
  const demo = !!opts.demo;
  const credentials: string[] = [];

  // ---- Founder -----------------------------------------------------------
  const founderEmail = (opts.founder?.email ?? "").trim().toLowerCase();
  let founderId: string | null = null;
  if (founderEmail) {
    const existing = await prisma.user.findUnique({ where: { email: founderEmail } });
    if (existing) {
      founderId = existing.id;
    } else {
      const pw = opts.founder?.password || genPassword();
      const u = await prisma.user.create({
        data: { email: founderEmail, name: opts.founder?.name || "Founder", role: "FOUNDER", passwordHash: await hashPassword(pw) },
      });
      founderId = u.id;
      credentials.push(`FOUNDER  ${founderEmail}  ${opts.founder?.password ? "(password as supplied)" : pw}`);
    }
  } else {
    if (!opts.quiet) console.warn("SEED_FOUNDER_EMAIL not set — no founder account created. Set it and re-run the seed.");
  }

  // ---- Programme skeleton -----------------------------------------------
  let programme = await prisma.programme.findFirst({ where: { active: true } });
  if (!programme) {
    const start = opts.programmeStart
      ? opts.programmeStart
      : demo
        ? new Date(Date.now() - 37 * DAY) // demo: mid-programme (week 6)
        : new Date(Date.now() + 14 * DAY);
    programme = await prisma.programme.create({
      data: {
        name: "Rotorua Tourism AI Growth Pilot — Cohort 1",
        description: "12-week pilot with ~10 Rotorua tourism operators: individual AI growth roadmaps plus the Tourism AI Growth Collective.",
        startDate: start,
        totalWeeks: 12,
        stages: { create: DEFAULT_STAGES },
        milestones: {
          create: [
            { title: "All operators onboarded & data agreements signed", week: 1 },
            { title: "Assessments and baselines complete", week: 2 },
            { title: "Priority use cases selected per operator", week: 3 },
            { title: "First implementations live", week: 6 },
            { title: "Shared experiments launched", week: 7 },
            { title: "Experiment results recorded", week: 10 },
            { title: "Results vs baseline + follow-on plans", week: 12 },
            { title: "Case studies drafted (with permission)", week: 12 },
          ],
        },
      },
    });
  }

  // ---- Workflow library: strategic records (honest status) ---------------
  if ((await prisma.workflowAsset.count()) === 0) {
    const assets = [
      {
        name: "Tourism Growth Intelligence",
        kind: "AUTOMATED_WORKFLOW" as const,
        status: "TESTING" as const,
        strategicInitiative: "Anchor intelligence — operator level",
        purpose: "A reusable, business-level growth adviser for individual operators: what changed, why it matters, what to do this week, and whether it worked (Scan → Brief → Learn).",
        problem: "Operators lack time and analytical capacity to turn their own signals (bookings, reviews, search, enquiries) into weekly decisions.",
        intendedUser: "Operator owner / manager, with Outside In as adviser",
        inputs: "Signals recorded per operator (claim-typed), opportunities, tasks, experiments and baselines stored in this platform. Source data is obtained by manual export in the pilot.",
        expectedOutput: "Weekly Growth Brief: max 3 actions with owner, effort and measure; learnings from completed experiments; explicit data gaps.",
        tools: ["This platform: Operator → Growth Intelligence", "Integrations registry (manual-import defaults)"],
        humanApproval: "Every brief is generated as a DRAFT and must be reviewed and approved by programme staff before it is shared to the operator portal.",
        limitations: "Absorbed from the separate prototype (anigemmill/tourism-growth-agent) into this platform as rules-based signal capture + brief generation. No LLM drafting is enabled and no live data connectors exist. Tested internally on synthetic data only — not yet validated with a pilot operator.",
        testResults: "Unit-tested brief builder (src/lib/domain/brief.test.ts) on synthetic inputs.",
        instructions: "Rules: (1) SCAN — list signals from the last 14 days, newest first, with claim type and source. (2) BRIEF — overdue/blocked tasks first, then highest-priority NOW opportunities, max 3. (3) LEARN — summarise completed/analysing experiments and their decisions. (4) State data gaps instead of filling them. Implementation: src/lib/domain/brief.ts.",
      },
      {
        name: "Rotorua Visitor Growth & Flow",
        kind: "CONCEPT_SPEC" as const,
        status: "CONCEPT" as const,
        strategicInitiative: "Anchor intelligence — destination level / Rotorua Pulse",
        purpose: "Destination-level intelligence to help Rotorua attract more visitors, encourage longer stays and improve dispersal.",
        problem: "Destination decisions are made without a regular, evidence-based view of demand, capacity and visitor flow.",
        intendedUser: "Destination partners (RotoruaNZ), Outside In, cohort operators (aggregate only)",
        inputs: "Public statistics (MBIE, Stats NZ), partner data via manual import, weather/holiday connectors, AI-discovery checks.",
        expectedOutput: "Monthly Rotorua Pulse briefing; scenario answers labelled fact/evidence/inference/hypothesis/recommendation.",
        tools: ["This platform: /destination modules", "Open-Meteo (unverified)", "Nager.Date (unverified)", "Claude API (optional)"],
        humanApproval: "Any published destination insight requires partner review.",
        limitations: "Data model, CSV import, Scenario Engine and AI Discovery runner exist in this codebase (Destination data section). Connectors have not been verified live. No real visitor/accommodation data has been imported. Strategic priority: NEXT.",
        instructions: "Specification: docs/ARCHITECTURE.md (destination intelligence).",
      },
      {
        name: "AI answer accuracy check (Rotorua First Answer)",
        kind: "PROMPT_TEMPLATE" as const,
        status: "TESTING" as const,
        strategicInitiative: "Rotorua First Answer",
        purpose: "Check how AI assistants describe an operator and Rotorua, and log missing or incorrect facts.",
        problem: "Travellers increasingly ask AI before visiting a website; wrong or missing details lose bookings invisibly.",
        intendedUser: "Outside In analyst during assessment; later the operator",
        inputs: "Operator name, key facts sheet (prices, hours, accessibility), 10 traveller questions.",
        expectedOutput: "Table: question / AI answer summary / mentioned? / factual errors / source cited.",
        tools: ["ChatGPT, Gemini, Claude (manual runs)"],
        humanApproval: "Analyst verifies every flagged error against the operator's own information before it is reported.",
        costNotes: "Manual: ~1 hour per operator per check.",
        limitations: "AI answers vary run to run; a single check is a snapshot, not a measurement of visibility. Do not treat mentions as proof of bookings.",
        instructions:
          "You are checking AI travel answers for accuracy.\n1. Ask each assistant: \"What are the best things to do in Rotorua?\", then \"Tell me about {{operator_name}} in Rotorua\" and the operator's 8 traveller questions.\n2. For each answer record: was the operator mentioned; position; any factual claim about prices, hours, location, accessibility; sources cited.\n3. Compare every claim with the verified facts sheet. Mark: correct / incorrect / not verifiable.\n4. Never 'correct' cultural or historical content yourself — flag it for the operator's cultural authority.",
      },
      {
        name: "Weekly Scan → Brief → Learn starter",
        kind: "PROMPT_TEMPLATE" as const,
        status: "CONCEPT" as const,
        strategicInitiative: "Tourism Growth Intelligence (starter)",
        purpose: "A three-step weekly routine for a single operator: gather signals, produce a one-page to-do list, check what worked.",
        intendedUser: "Operator, supported by Outside In",
        inputs: "Last week's reviews, enquiries, bookings summary, and any AI-answer checks.",
        expectedOutput: "One-page Monday brief with max 3 actions, each with an owner and how success will be checked.",
        tools: ["Claude or ChatGPT (manual)"],
        humanApproval: "Operator decides which actions to take.",
        limitations: "Not yet tested with any pilot operator.",
        instructions:
          "SCAN: Summarise the signals provided below in plain language. Separate what the data shows from what you are guessing.\nBRIEF: Recommend no more than 3 actions for this week. For each: why, expected effect, effort (S/M/L), owner, how we will know it worked.\nLEARN: Compare last week's actions with what happened. State clearly when the data cannot show whether an action worked.",
      },
      {
        name: "Enquiry auto-acknowledgement with FAQ answers",
        kind: "AUTOMATED_WORKFLOW" as const,
        status: "CONCEPT" as const,
        strategicInitiative: "Operator implementation",
        purpose: "Reply to web enquiries within minutes with verified FAQ answers and a booking link; route complex questions to staff.",
        intendedUser: "Operators with high enquiry volume",
        inputs: "Enquiry form submissions, verified FAQ sheet.",
        expectedOutput: "Draft or sent acknowledgement email; staff notification for unanswered questions.",
        tools: ["Existing email/CRM platform", "Zapier or Make (optional)", "LLM for drafting (optional)"],
        humanApproval: "Start in draft-only mode; operator approves before switching to auto-send.",
        costNotes: "Typically existing tools; automation platform NZD 30–60/month if needed.",
        limitations: "Must only answer from the verified FAQ; no pricing promises outside the booking system.",
        instructions: "Workflow outline: trigger on new enquiry → classify (FAQ / booking / complex) → draft reply from verified FAQ → hold for approval (phase 1) → send + log.",
      },
    ];
    for (const a of assets) {
      const { instructions, ...rest } = a;
      await prisma.workflowAsset.create({
        data: {
          ...rest,
          versions: { create: { version: 1, instructions, changeNote: "Initial record", createdBy: "seed" } },
        },
      });
    }
  }

  if ((await prisma.solutionTemplate.count()) === 0) {
    const answerCheck = await prisma.workflowAsset.findFirst({ where: { name: { startsWith: "AI answer accuracy" } } });
    const enquiry = await prisma.workflowAsset.findFirst({ where: { name: { startsWith: "Enquiry auto" } } });
    await prisma.solutionTemplate.createMany({
      data: [
        {
          name: "Traveller FAQ & AI-ready facts page", area: "AI_SEARCH_VISIBILITY", solutionType: "WEBSITE_CONTENT",
          description: "Publish plain-language answers to the questions visitors actually ask (prices, hours, accessibility, 'is it worth it', weather options) and keep facts consistent across website, Google profile and booking listings.",
          steps: "1. Collect top 20 questions from enquiries/reviews\n2. Verify answers with operator\n3. Publish FAQ page with structured data\n4. Align Google Business Profile + OTA listings\n5. Re-run AI answer accuracy check after 4 weeks",
          typicalEffortHours: 8, typicalOneOffNzd: 900, typicalMonthlyNzd: 0, tools: ["Website CMS", "Google Business Profile"],
          successMetric: "AI answer accuracy; referral traffic to FAQ; enquiry volume on answered topics", workflowAssetId: answerCheck?.id,
        },
        {
          name: "Enquiry fast-response workflow", area: "ENQUIRIES_CONVERSION", solutionType: "AUTOMATION",
          description: "Acknowledge enquiries within minutes with verified answers and a booking link.",
          typicalEffortHours: 10, typicalOneOffNzd: 1200, typicalMonthlyNzd: 50, tools: ["Email/CRM", "Zapier/Make"],
          successMetric: "Median response time; enquiry→booking conversion", workflowAssetId: enquiry?.id,
        },
        {
          name: "Review-response drafting assistant", area: "FEEDBACK_PRODUCT", solutionType: "AI_ASSISTED",
          description: "Draft responses to reviews in the operator's voice for human approval, and tag recurring themes for product decisions.",
          typicalEffortHours: 4, typicalOneOffNzd: 450, typicalMonthlyNzd: 30, tools: ["LLM assistant"],
          successMetric: "Review response rate; time spent; themes actioned",
        },
        {
          name: "Pre-arrival guest information sequence", area: "GUEST_COMMUNICATIONS", solutionType: "PROCESS_CHANGE",
          description: "A simple 2–3 message pre-arrival sequence with directions, what to bring, weather alternatives and add-on suggestions.",
          typicalEffortHours: 6, typicalOneOffNzd: 700, typicalMonthlyNzd: 0, tools: ["Booking system messaging"],
          successMetric: "Pre-arrival questions; add-on revenue; satisfaction",
        },
      ],
    });
  }

  if (!demo) {
    if (!opts.quiet) report(credentials, false);
    return;
  }
  if ((await prisma.operator.count({ where: { isSynthetic: true } })) > 0) {
    if (!opts.quiet) {
      console.log("Synthetic demo cohort already present — skipping demo data.");
      report(credentials, true);
    }
    return;
  }

  await seedDemoCohort(prisma, programme.id, programme.startDate, founderId, credentials, opts.demoPassword);
  if (!opts.quiet) report(credentials, true);
}

function report(credentials: string[], demo: boolean) {
  console.log(`Growth OS seeded${demo ? " (with SYNTHETIC demo cohort)" : ""}.`);
  if (credentials.length) {
    console.log("\nAccounts created (store these securely; they are not shown again):");
    for (const c of credentials) console.log("  " + c);
  }
}

async function seedDemoCohort(
  prisma: PrismaClient,
  programmeId: string,
  start: Date,
  founderId: string | null,
  credentials: string[],
  demoPassword?: string
) {
  const week = (w: number, dayOffset = 0) => new Date(start.getTime() + ((w - 1) * 7 + dayOffset) * DAY);

  const adminPw = demoPassword || genPassword();
  const admin = await prisma.user.create({
    data: { email: "admin@demo.example", name: "Demo Programme Admin", role: "ADMIN", passwordHash: await hashPassword(adminPw) },
  });
  credentials.push(`ADMIN    admin@demo.example  ${demoPassword ? "(SEED_DEMO_PASSWORD)" : adminPw}`);
  const ownerId = founderId ?? admin.id;

  const ops = [
    { name: "Lakeside Retreat Lodge", category: "accommodation", status: "ACTIVE", ai: 2, markets: ["Domestic – Auckland", "Australia"], channels: ["Website", "Booking.com", "Instagram"], tech: ["Little Hotelier", "Mailchimp"], tags: ["overnight-package", "stay-another-night"], consent: [true, true, true] },
    { name: "Redwoods Ridge Bike Tours", category: "activity", status: "ACTIVE", ai: 3, markets: ["Domestic", "Australia", "USA"], channels: ["Website", "Instagram", "TripAdvisor"], tech: ["Rezdy", "ChatGPT"], tags: ["overnight-package", "content-heavy"], consent: [true, true, false] },
    { name: "Steam Valley Thermal Spa", category: "wellness", status: "ACTIVE", ai: 1, markets: ["Domestic", "China", "Australia"], channels: ["Website", "Google Ads", "Facebook"], tech: ["Custom booking", "Excel"], tags: ["ai-visibility", "needs-booking-help"], consent: [true, true, false] },
    { name: "Crater Rim Adventures", category: "activity", status: "ACTIVE", ai: 2, markets: ["Backpackers", "Domestic families"], channels: ["Website", "Viator", "Instagram"], tech: ["FareHarbor"], tags: ["content-heavy"], consent: [true, false, false] },
    { name: "Old Town Motor Inn", category: "accommodation", status: "ACTIVE", ai: 1, markets: ["Domestic road-trippers", "Business travel"], channels: ["Booking.com", "Expedia"], tech: ["RMS", "Outlook"], tags: ["stay-another-night", "admin-heavy"], consent: [true, true, false] },
    { name: "Lakefront Kayak Co", category: "activity", status: "ONBOARDING", ai: 2, markets: ["Domestic", "Europe"], channels: ["Website", "Instagram"], tech: ["Bookeo"], tags: ["seasonal"], consent: [true, false, false] },
    { name: "Forest Table Kitchen", category: "food-beverage", status: "ONBOARDING", ai: 1, markets: ["Locals", "Domestic visitors"], channels: ["Instagram", "Google"], tech: ["OpenTable"], tags: ["evening-economy"], consent: [false, false, false] },
    { name: "Evening Cultural Experience (demo)", category: "cultural", status: "ACTIVE", ai: 1, markets: ["International groups", "Domestic"], channels: ["Inbound operators", "Website"], tech: ["Excel", "Email"], tags: ["evening-economy", "cultural-review"], consent: [true, false, false] },
    { name: "Geyser Shuttle Services", category: "transport", status: "INVITED", ai: 1, markets: ["Cruise", "Independent travellers"], channels: ["Inbound operators"], tech: ["Phone", "Email"], tags: ["dispersal"], consent: [false, false, false] },
    { name: "Hillside Holiday Park", category: "accommodation", status: "ACTIVE", ai: 2, markets: ["Domestic families", "Campervans"], channels: ["Website", "Facebook", "Campermate"], tech: ["Newbook"], tags: ["stay-another-night", "seasonal"], consent: [true, true, true] },
  ] as const;

  const created: { id: string; name: string }[] = [];
  for (const [i, o] of ops.entries()) {
    const slug = o.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
    const op = await prisma.operator.create({
      data: {
        programmeId,
        name: o.name,
        category: o.category,
        status: o.status,
        isSynthetic: true,
        contactName: `Demo Contact ${i + 1}`,
        contactEmail: `contact@${slug}.example`,
        websiteUrl: `https://${slug}.example`,
        bookingUrl: `https://${slug}.example/book`,
        experiences: `Synthetic demo description for ${o.name}.`,
        targetMarkets: [...o.markets],
        marketingChannels: [...o.channels],
        techStack: [...o.tech],
        bookingProcess: i % 2 ? "Online booking via booking system; phone enquiries handled manually." : "Mix of OTA and direct website bookings; email enquiries answered same/next day.",
        objectives: "Grow direct bookings and reduce time spent on repetitive admin.",
        challenges: "Limited staff time; inconsistent information across listings.",
        aiMaturity: o.ai,
        seasonality: o.category === "accommodation" ? "Peak Dec–Feb; shoulder weekdays under-utilised." : "Weather-dependent; winter weekdays quiet.",
        groupTags: [...o.tags],
        agreedScope: o.status === "INVITED" ? null : "Assessment, roadmap, up to 2 implementations, collective participation.",
        dataAgreementSignedAt: o.status === "ACTIVE" ? week(1, 2) : null,
        consentCohortSharing: o.consent[0],
        consentAggregate: o.consent[1],
        consentCaseStudy: o.consent[2],
        dataRetentionNotes: "Delete operator exports 12 months after programme end unless renewed.",
        culturalGuidance:
          o.category === "cultural"
            ? "Cultural narratives, kōrero and imagery belong to the operator's iwi/hapū authority. Do not place them into AI tools or generate interpretations. All public cultural content must be approved by the named authority."
            : null,
      },
    });
    created.push({ id: op.id, name: op.name });
  }
  const opId = (n: number) => created[n].id;

  // Operator logins for the first two demo operators (data-isolation demo)
  const opPw = demoPassword || genPassword();
  for (const n of [0, 1]) {
    const email = `operator${n + 1}@demo.example`;
    await prisma.user.create({ data: { email, name: `${created[n].name} (operator)`, role: "OPERATOR", operatorId: opId(n), passwordHash: await hashPassword(opPw), businesses: { create: { operatorId: opId(n), isPrimaryContact: true } } } });
    credentials.push(`OPERATOR ${email}  ${demoPassword ? "(SEED_DEMO_PASSWORD)" : opPw}  → ${created[n].name}`);
  }

  // Assessments
  const areas = [
    "AI_SEARCH_VISIBILITY", "MARKETING_CONTENT", "ENQUIRIES_CONVERSION", "BOOKING_JOURNEY", "GUEST_COMMUNICATIONS",
    "ADMIN_WORKLOAD", "REPORTING_DECISIONS", "OPERATIONS", "FEEDBACK_PRODUCT",
  ] as const;
  const assessmentIds: Record<number, string> = {};
  for (const n of [0, 1, 2, 3, 4, 7, 9, 5]) {
    const complete = n !== 5 && n !== 9;
    const a = await prisma.assessment.create({
      data: {
        operatorId: opId(n),
        status: complete ? "COMPLETE" : "IN_PROGRESS",
        conductedBy: "Demo Programme Admin",
        conductedAt: week(1, 3 + (n % 4)),
        sharedWithOperator: complete,
        summary: complete ? "Synthetic assessment summary: strongest gains likely in enquiry handling and consistent online information." : null,
        areas: {
          create: areas.map((area, j) => ({
            area,
            score: complete || j < 4 ? ((n + j) % 4) + 1 : null,
            observed: j === 0 ? "Website lacks prices and accessibility info; AI assistants gave outdated opening hours (synthetic)." : null,
            reported: j === 2 ? "Operator reports answering ~25 repetitive enquiry emails per week (synthetic)." : null,
          })),
        },
      },
    });
    assessmentIds[n] = a.id;
  }

  const templates = await prisma.solutionTemplate.findMany();
  const tpl = (name: string) => templates.find((t) => t.name.startsWith(name))?.id;

  // Opportunities
  type OppSeed = Parameters<typeof prisma.opportunity.create>[0]["data"];
  const opps: OppSeed[] = [
    { operatorId: opId(0), assessmentId: assessmentIds[0], templateId: tpl("Enquiry"), title: "Fast-response enquiry workflow", area: "ENQUIRIES_CONVERSION", solutionType: "AUTOMATION", problem: "Email enquiries wait up to 24h; some book elsewhere.", currentProcess: "Owner answers manually each evening.", proposedSolution: "Auto-acknowledge with verified FAQ answers + booking link; staff handle complex questions.", expectedValue: "Faster responses should lift enquiry→booking conversion.", expectedValueNzd: 9000, impactScore: 4, effortScore: 2, effortHours: 10, oneOffCostNzd: 1200, monthlyCostNzd: 50, successMetric: "Enquiry→booking conversion", baselineMetric: "18% (operator estimate)", targetMetric: "24%", evidenceBasis: "OPERATOR_REPORTED", confidence: "MEDIUM", horizon: "NOW", status: "IN_PROGRESS", ownerId, tools: ["Mailchimp", "Zapier"] },
    { operatorId: opId(0), assessmentId: assessmentIds[0], title: "Stay-another-night bundle with bike tour", area: "BOOKING_JOURNEY", solutionType: "PROCESS_CHANGE", problem: "Most guests stay one night; Sunday nights under-utilised.", proposedSolution: "Package a 2nd night with a partner activity via the Growth Collective.", impactScore: 4, effortScore: 3, evidenceBasis: "HYPOTHESIS", confidence: "LOW", horizon: "NOW", status: "APPROVED", ownerId },
    { operatorId: opId(1), assessmentId: assessmentIds[1], templateId: tpl("Traveller FAQ"), title: "AI-ready trail & tour FAQ", area: "AI_SEARCH_VISIBILITY", solutionType: "WEBSITE_CONTENT", problem: "AI assistants recommend competitors for 'guided mountain biking Rotorua'.", proposedSolution: "Publish verified FAQ + consistent facts across Google/OTA listings.", impactScore: 3, effortScore: 2, oneOffCostNzd: 900, evidenceBasis: "OBSERVED", confidence: "MEDIUM", horizon: "NOW", status: "IN_PROGRESS", ownerId, visibility: "COHORT" },
    { operatorId: opId(1), title: "AI-assisted content calendar", area: "MARKETING_CONTENT", solutionType: "AI_ASSISTED", problem: "Content production is ad hoc.", proposedSolution: "Monthly AI-assisted calendar from trail conditions + events, human-edited.", impactScore: 2, effortScore: 2, evidenceBasis: "OPERATOR_REPORTED", confidence: "MEDIUM", horizon: "NEXT", status: "IDENTIFIED" },
    { operatorId: opId(2), assessmentId: assessmentIds[2], templateId: tpl("Traveller FAQ"), title: "Fix inaccurate hours & prices in AI answers", area: "AI_SEARCH_VISIBILITY", solutionType: "WEBSITE_CONTENT", problem: "AI assistants state outdated hours and prices.", proposedSolution: "Correct website + Google profile; publish facts page.", impactScore: 4, effortScore: 1, evidenceBasis: "OBSERVED", confidence: "HIGH", horizon: "NOW", status: "LIVE", ownerId },
    { operatorId: opId(2), title: "Replace spreadsheet booking with booking system", area: "BOOKING_JOURNEY", solutionType: "PROCESS_CHANGE", problem: "Custom booking + Excel causes double-handling.", proposedSolution: "Evaluate a standard booking platform — not an AI problem.", impactScore: 5, effortScore: 4, evidenceBasis: "OBSERVED", confidence: "MEDIUM", horizon: "NEXT", status: "IDENTIFIED" },
    { operatorId: opId(3), assessmentId: assessmentIds[3], templateId: tpl("Review-response"), title: "Review-response drafting", area: "FEEDBACK_PRODUCT", solutionType: "AI_ASSISTED", problem: "60% of reviews unanswered.", proposedSolution: "Draft replies in brand voice for approval; tag themes monthly.", impactScore: 2, effortScore: 1, evidenceBasis: "OBSERVED", confidence: "HIGH", horizon: "NOW", status: "PRIORITISED" },
    { operatorId: opId(4), assessmentId: assessmentIds[4], title: "Automate nightly occupancy report", area: "ADMIN_WORKLOAD", solutionType: "AUTOMATION", problem: "Manager spends ~3h/week compiling reports by hand.", proposedSolution: "Scheduled RMS export to a simple dashboard.", impactScore: 3, effortScore: 2, effortHours: 6, evidenceBasis: "OPERATOR_REPORTED", confidence: "MEDIUM", horizon: "NOW", status: "IN_PROGRESS", ownerId },
    { operatorId: opId(7), assessmentId: assessmentIds[7], title: "Pre-arrival information for groups", area: "GUEST_COMMUNICATIONS", solutionType: "PROCESS_CHANGE", problem: "Inbound operators pass on incomplete arrival information.", proposedSolution: "Standard pre-arrival sheet for inbound partners. Cultural content excluded from AI tools.", impactScore: 3, effortScore: 2, evidenceBasis: "OPERATOR_REPORTED", confidence: "MEDIUM", horizon: "NEXT", status: "IDENTIFIED" },
    { operatorId: opId(9), title: "Midweek family offer test", area: "MARKETING_CONTENT", solutionType: "PROCESS_CHANGE", problem: "Midweek shoulder occupancy low.", proposedSolution: "Targeted offer to past guests for a second night.", impactScore: 3, effortScore: 2, evidenceBasis: "HYPOTHESIS", confidence: "LOW", horizon: "NEXT", status: "PRIORITISED" },
  ];
  const oppIds: string[] = [];
  for (const o of opps) oppIds.push((await prisma.opportunity.create({ data: o })).id);

  // Shared initiative
  const initiative = await prisma.sharedInitiative.create({
    data: {
      programmeId,
      title: "Ride & Rest: second-night bike package",
      description: "Accommodation + guided ride package to convert one-night stays into two (Stay Another Night test).",
      initiativeType: "stay-another-night",
      status: "IN_PROGRESS",
      attributionMethod: "Unique package code redeemed at both businesses; lodge records nights, bike tours records rides.",
      participants: {
        create: [
          { operatorId: opId(0), role: "Accommodation partner", responsibilities: "Package page, room inventory, guest comms", consentConfirmed: true },
          { operatorId: opId(1), role: "Activity partner", responsibilities: "Guided ride slots, booking code redemption", consentConfirmed: true },
        ],
      },
    },
  });

  // Projects & tasks
  const p1 = await prisma.project.create({
    data: { title: "Enquiry fast-response workflow", operatorId: opId(0), opportunityId: oppIds[0], status: "IN_PROGRESS", startDate: week(3), dueDate: week(6), tools: ["Mailchimp", "Zapier"], oneOffCostNzd: 1200, monthlyCostNzd: 50, testingNotes: "Draft-only mode for 2 weeks before auto-send.", adoption: "partial" },
  });
  const p2 = await prisma.project.create({
    data: { title: "Hours & prices correction", operatorId: opId(2), opportunityId: oppIds[4], status: "DONE", startDate: week(3), dueDate: week(4), tools: ["Website CMS", "Google Business Profile"], approvedBy: "Demo Contact 3", approvedAt: week(4), adoption: "embedded" },
  });
  const p3 = await prisma.project.create({
    data: { title: "Ride & Rest package build", initiativeId: initiative.id, status: "IN_PROGRESS", startDate: week(5), dueDate: week(7), tools: ["Little Hotelier", "Rezdy"] },
  });
  const now = Date.now();
  const tasks = [
    { title: "Collect top 20 enquiry questions", operatorId: opId(0), projectId: p1.id, status: "DONE", dueDate: week(3, 4), ownerLabel: "Operator" },
    { title: "Verify FAQ answers with owner", operatorId: opId(0), projectId: p1.id, status: "IN_PROGRESS", dueDate: new Date(now + 2 * DAY), assigneeId: ownerId },
    { title: "Switch workflow from draft-only to auto-send (needs approval)", operatorId: opId(0), projectId: p1.id, status: "TODO", dueDate: new Date(now + 9 * DAY), ownerLabel: "Operator approval" },
    { title: "Send baseline booking export", operatorId: opId(3), status: "TODO", dueDate: new Date(now - 4 * DAY), ownerLabel: "Operator" },
    { title: "Sign data-sharing agreement", operatorId: opId(5), status: "TODO", dueDate: new Date(now - 10 * DAY), ownerLabel: "Operator" },
    { title: "Complete assessment interview", operatorId: opId(9), status: "IN_PROGRESS", dueDate: new Date(now + 1 * DAY), assigneeId: admin.id },
    { title: "Create package page", initiativeId: initiative.id, projectId: p3.id, operatorId: opId(0), status: "IN_PROGRESS", dueDate: new Date(now + 5 * DAY), ownerLabel: "Lodge" },
    { title: "Set up redemption code in Rezdy", initiativeId: initiative.id, projectId: p3.id, operatorId: opId(1), status: "BLOCKED", dueDate: new Date(now - 1 * DAY), ownerLabel: "Bike tours" },
    { title: "Confirm cultural authority sign-off process", operatorId: opId(7), status: "TODO", dueDate: new Date(now + 3 * DAY), assigneeId: ownerId, priority: "NOW" },
    { title: "Book workshop 4 venue", status: "TODO", dueDate: new Date(now + 6 * DAY), assigneeId: admin.id, visibility: "INTERNAL" },
    { title: "Upload Google Business Profile changes", operatorId: opId(2), projectId: p2.id, status: "DONE", dueDate: week(4), ownerLabel: "Operator" },
  ] as const;
  for (const t of tasks) await prisma.task.create({ data: { ...t, completedAt: t.status === "DONE" ? new Date(now - 7 * DAY) : null } });

  // Workshops
  const ws = [
    { title: "Kick-off: AI in tourism, honestly", week: 1, status: "DONE", agenda: "Programme overview\nWhat AI can and can't do\nData permissions & cultural governance\nBaseline measurement plan" },
    { title: "Your visitors ask AI first", week: 3, status: "DONE", agenda: "Live AI answer checks\nFAQ and facts consistency\nPicking priority use cases" },
    { title: "Automation clinic", week: 5, status: "DONE", agenda: "Enquiry workflows\nReview responses\nWhen NOT to use AI" },
    { title: "Collaboration lab: stay another night", week: 7, status: "TODO", agenda: "Package design\nAttribution between partners\nExperiment design" },
    { title: "Evidence review", week: 9, status: "TODO", agenda: "What the numbers can and can't show\nLimitations\nShared learnings" },
    { title: "Measure & decide", week: 11, status: "TODO", agenda: "Results vs baseline\nScale / amend / stop\nFollow-on plans" },
  ] as const;
  const workshopIds: string[] = [];
  for (const w of ws) {
    const created2 = await prisma.workshop.create({ data: { ...w, programmeId, date: week(w.week, 2), location: "Rotorua (venue TBC) / video link" } });
    workshopIds.push(created2.id);
    if (w.status === "DONE") {
      for (const [i, c] of created.entries()) {
        if (i === 8) continue;
        await prisma.workshopAttendance.create({
          data: { workshopId: created2.id, operatorId: c.id, attended: (i + w.week) % 5 !== 0, engagement: ((i + w.week) % 3) + 3 },
        });
      }
    }
  }

  // Learnings & resources
  await prisma.learning.createMany({
    data: [
      { title: "AI assistants repeat whatever is inconsistent online", body: "Three operators found AI answers quoting old prices that still appeared on one OTA listing. Fixing the source listing mattered more than adding new content. (Synthetic learning.)", topic: "AI search visibility", workshopId: workshopIds[1], visibility: "COHORT", isReusableProcess: false, createdBy: "seed" },
      { title: "Draft-only mode before auto-send", body: "Run any customer-facing automation in draft-only mode for two weeks. Operators caught tone and pricing issues before guests saw them. (Synthetic.)", topic: "Automation", workshopId: workshopIds[2], visibility: "COHORT", isReusableProcess: true, createdBy: "seed" },
      { title: "Lodge enquiry volume by topic", body: "Breakdown of the lodge's enquiries by topic — confidential to the operator. (Synthetic.)", topic: "Enquiries", operatorId: opId(0), visibility: "CONFIDENTIAL", createdBy: "seed" },
      { title: "Cultural narrative for evening experience", body: "Placeholder — content held by the operator's cultural authority; not stored here.", topic: "Cultural governance", operatorId: opId(7), visibility: "CONFIDENTIAL", culturalReview: "REQUIRED", createdBy: "seed" },
    ],
  });
  await prisma.resource.createMany({
    data: [
      { title: "AI answer accuracy check — worksheet", resourceType: "template", description: "Copy for each operator; record AI answers and errors.", url: "https://example.com/replace-with-drive-link", visibility: "COHORT" },
      { title: "Traveller FAQ template", resourceType: "template", description: "20 question starter list.", visibility: "COHORT" },
      { title: "Data permissions explainer (plain language)", resourceType: "guide", description: "What we collect, why, who sees it, how long we keep it.", visibility: "COHORT" },
      { title: "Workshop 2 recording", resourceType: "recording", visibility: "COHORT" },
    ],
  });

  // Experiments
  const e1 = await prisma.experiment.create({
    data: {
      title: "Ride & Rest second-night package", initiativeId: initiative.id, opportunityId: oppIds[1], isIllustrative: true,
      hypothesis: "Offering a bundled second night with a guided ride will convert at least 8% of one-night guests into two-night stays.",
      problem: "One-night stays dominate; Sunday nights under-utilised.", audience: "Guests booking a single Fri/Sat night, Nov–Dec",
      intervention: "Package offer in booking confirmation + package page", startDate: week(7), endDate: week(10), baselineStart: week(-8), baselineEnd: week(0),
      comparisonMethod: "MATCHED_COMPARISON", primaryMetric: "GUEST_NIGHTS", primaryMetricLabel: "Incremental second nights", secondaryMetrics: ["Package bookings", "Ride revenue"],
      baselineValue: 0, targetValue: 30, minimumAcceptable: 12, maxCostNzd: 1500, status: "DESIGN",
      attributionNotes: "Only package-code redemptions count; guests who would have stayed anyway cannot be fully excluded.",
    },
  });
  const e2 = await prisma.experiment.create({
    data: {
      title: "FAQ facts page → AI answer accuracy", operatorId: opId(2), opportunityId: oppIds[4], isIllustrative: true,
      hypothesis: "Correcting source listings and publishing a facts page will raise AI answer accuracy on 10 tracked questions from 40% to 80%.",
      problem: "AI assistants state outdated hours and prices.", intervention: "Facts page + listing corrections",
      startDate: week(3), endDate: week(7), baselineStart: week(1), baselineEnd: week(2), comparisonMethod: "BEFORE_AFTER",
      primaryMetric: "AI_SEARCH_VISIBILITY", primaryMetricLabel: "% tracked answers factually correct", baselineValue: 40, targetValue: 80, minimumAcceptable: 60,
      actualValue: 70, actualCostNzd: 600, maxCostNzd: 1000, status: "ANALYSING",
      resultSummary: "Illustrative: 7 of 10 answers correct after 4 weeks.",
      limitations: "AI answers vary by run and model; two assistants not re-tested. Accuracy is not evidence of bookings.",
    },
  });
  await prisma.experiment.create({
    data: {
      title: "Enquiry auto-acknowledgement", operatorId: opId(0), opportunityId: oppIds[0], isIllustrative: true,
      hypothesis: "Responding within 10 minutes will lift enquiry→booking conversion from 18% to 24%.", problem: "Slow enquiry responses.",
      intervention: "Fast-response workflow", startDate: week(5), endDate: week(10), comparisonMethod: "BEFORE_AFTER",
      primaryMetric: "BOOKING_CONVERSION", baselineValue: 18, targetValue: 24, minimumAcceptable: 21, status: "RUNNING",
      secondaryMetrics: ["Median response time", "Owner hours on email"],
    },
  });

  // Measurements (all illustrative)
  const mm = (operatorId: string, metric: string, kind: "BASELINE" | "RESULT", value: number, unit: string, w: number, extra: Record<string, unknown> = {}) =>
    prisma.measurement.create({
      data: {
        operatorId, metric: metric as never, kind, value, unit, periodStart: week(w - 4), periodEnd: week(w),
        source: "Synthetic demo value", evidenceKind: kind === "BASELINE" ? "OPERATOR_REPORTED" : "MEASURED", isIllustrative: true, recordedBy: "seed", ...extra,
      },
    });
  await mm(opId(0), "QUALIFIED_ENQUIRIES", "BASELINE", 64, "per month", 1);
  await mm(opId(0), "BOOKING_CONVERSION", "BASELINE", 18, "%", 1);
  await mm(opId(0), "TIME_SAVED_HOURS", "BASELINE", 0, "hours/week", 1);
  await mm(opId(0), "TIME_SAVED_HOURS", "RESULT", 3.5, "hours/week", 6, { notes: "Owner estimate after 2 weeks draft-mode" });
  await mm(opId(1), "AI_SEARCH_VISIBILITY", "BASELINE", 20, "% of tracked prompts", 1);
  await mm(opId(1), "REFERRAL_TRAFFIC", "BASELINE", 410, "sessions/month", 1);
  await mm(opId(2), "AI_SEARCH_VISIBILITY", "BASELINE", 40, "% answers correct", 2, { experimentId: e2.id });
  await mm(opId(2), "AI_SEARCH_VISIBILITY", "RESULT", 70, "% answers correct", 7, { experimentId: e2.id });
  await mm(opId(3), "GUEST_SATISFACTION", "BASELINE", 4.3, "avg rating /5", 1);
  await mm(opId(4), "TIME_SAVED_HOURS", "BASELINE", 0, "hours/week", 1);
  await mm(opId(4), "GUEST_NIGHTS", "BASELINE", 1840, "nights/month", 1);
  await mm(opId(9), "GUEST_NIGHTS", "BASELINE", 2210, "nights/month", 1);
  void e1;

  // Growth Intelligence signals (illustrative)
  const sig = (operatorId: string, d: number, data: Record<string, unknown>) =>
    prisma.signal.create({ data: { operatorId, sourceTimestamp: new Date(now - d * DAY), isIllustrative: true, createdBy: "seed", ...data } as never });
  await sig(opId(0), 3, { type: "ENQUIRY", title: "Six enquiries this week asked about bike storage", summary: "Guests ask whether bikes can be stored securely overnight.", claimType: "OBSERVATION", source: "Operator inbox sample", confidence: "MEDIUM", momentum: "RISING", commercialPotential: "MEDIUM" });
  await sig(opId(0), 5, { type: "REVIEW", title: "Two reviews mention slow email replies", summary: "Recent reviews reference waiting for answers before booking.", claimType: "FACT", source: "Google reviews (staff sample)", confidence: "HIGH" });
  await sig(opId(0), 6, { type: "DEMAND", title: "Sunday nights remain the weakest night", summary: "Operator reports Sunday occupancy well below Fri/Sat.", claimType: "OBSERVATION", source: "Operator (Little Hotelier summary)", confidence: "MEDIUM", submittedByOperator: true });
  await sig(opId(0), 6, { type: "MARKET", title: "Bike visitors may extend if a guided ride is bundled", summary: "Untested belief behind the Ride & Rest package.", claimType: "HYPOTHESIS", source: "Workshop 3 discussion", confidence: "LOW" });
  await sig(opId(1), 4, { type: "AI_DISCOVERY", title: "AI assistants recommend a competitor for guided MTB", summary: "3 of 4 assistants named another operator first.", claimType: "FACT", source: "AI answer accuracy check (manual)", confidence: "MEDIUM" });
  await sig(opId(2), 8, { type: "AI_DISCOVERY", title: "Hours now correct in 3 of 4 assistants", summary: "After listing corrections.", claimType: "FACT", source: "AI answer accuracy check (manual)", confidence: "MEDIUM" });

  // Workflow usage
  const check = await prisma.workflowAsset.findFirst({ where: { name: { startsWith: "AI answer accuracy" } } });
  if (check) for (const n of [1, 2]) await prisma.workflowUsage.create({ data: { assetId: check.id, operatorId: opId(n), status: "piloting" } });
  const tgi = await prisma.workflowAsset.findFirst({ where: { name: "Tourism Growth Intelligence" } });
  if (tgi) await prisma.workflowUsage.create({ data: { assetId: tgi.id, operatorId: opId(0), status: "piloting", notes: "Weekly brief trial (synthetic)." } });

  // Risks & decisions
  await prisma.risk.createMany({
    data: [
      { kind: "BLOCKER", title: "Rezdy redemption code not set up", severity: "HIGH", operatorId: opId(1), owner: "Bike tours", mitigation: "Fallback: manual code log shared weekly.", status: "IN_PROGRESS" },
      { kind: "RISK", title: "Baseline data missing for 3 operators", severity: "MEDIUM", owner: "Programme admin", mitigation: "Accept operator estimates, labelled as such; chase exports.", status: "TODO" },
      { kind: "RISK", title: "Cultural content could enter AI tools via copy-paste", severity: "HIGH", operatorId: opId(7), owner: "Founder", mitigation: "Explicit guidance in workshop 1; cultural review flag on learnings/resources.", status: "TODO" },
    ],
  });
  await prisma.decisionRecord.createMany({
    data: [
      { title: "Approve auto-send for lodge enquiry workflow?", whatChanged: "Two weeks of draft-only mode completed with 3 minor edits.", evidence: "Draft log reviewed by owner (synthetic).", whyItMatters: "Auto-send is the step that saves time and speeds response.", nextAction: "Owner to approve or extend draft mode", owner: "Operator + Founder", reviewDate: new Date(now + 7 * DAY), operatorId: opId(0) },
      { title: "Offer a recurring intelligence service after the pilot?", whatChanged: "4 operators asked about ongoing support at workshop 3.", evidence: "Workshop notes (synthetic).", whyItMatters: "Recurring revenue is core to commercial sustainability.", nextAction: "Draft service options + pricing for week 10", owner: "Founder", reviewDate: new Date(now + 21 * DAY) },
    ],
  });

  // Commercial (illustrative)
  const deals = [
    ...[0, 1, 2, 3, 4, 7, 9].map((n) => ({ title: `Pilot participation — ${created[n].name}`, organisation: created[n].name, operatorId: opId(n), type: "PARTICIPATION_FEE" as const, stage: "CONTRACTED" as const, oneOffValueNzd: 2500, probability: 100, contractSignedAt: week(1) })),
    { title: "Pilot participation — Lakefront Kayak Co", organisation: "Lakefront Kayak Co", operatorId: opId(5), type: "PARTICIPATION_FEE" as const, stage: "QUOTED" as const, oneOffValueNzd: 2500, probability: 70 },
    { title: "Destination sponsorship", organisation: "Destination partner (TBC)", type: "SPONSORSHIP" as const, stage: "PROPOSED" as const, oneOffValueNzd: 15000, probability: 35 },
    { title: "Booking system migration support", organisation: created[2].name, operatorId: opId(2), type: "IMPLEMENTATION" as const, stage: "OPPORTUNITY" as const, oneOffValueNzd: 4500, probability: 30 },
    { title: "Monthly growth intelligence", organisation: created[0].name, operatorId: opId(0), type: "RECURRING_SERVICE" as const, stage: "PROPOSED" as const, monthlyValueNzd: 450, termMonths: 12, probability: 50, renewalDate: week(26) },
  ];
  for (const d of deals) {
    const deal = await prisma.deal.create({ data: { ...d, isIllustrative: true } });
    if (d.stage === "CONTRACTED" && d.operatorId && [opId(0), opId(1), opId(2), opId(4)].includes(d.operatorId)) {
      await prisma.payment.create({ data: { dealId: deal.id, amountNzd: 2500, receivedAt: week(2), reference: "DEMO-INV" } });
    }
  }
  await prisma.costItem.createMany({
    data: [
      { description: "Founder delivery time (weeks 1–5)", category: "DELIVERY_LABOUR", amountNzd: 9000, incurredAt: week(5), isIllustrative: true },
      { description: "AI tools & automation platform", category: "SOFTWARE", amountNzd: 180, incurredAt: week(1), isMonthly: true, isIllustrative: true },
      { description: "Workshop venue x6", category: "VENUE", amountNzd: 1800, incurredAt: week(11), isForecast: true, isIllustrative: true },
      { description: "Delivery time (weeks 6–12)", category: "DELIVERY_LABOUR", amountNzd: 11000, incurredAt: week(12), isForecast: true, isIllustrative: true },
    ],
  });
  await prisma.pricingScenario.createMany({
    data: [
      { name: "Pilot: 10 operators @ $2.5k + sponsor", cohortSize: 10, feePerOperatorNzd: 2500, sponsorshipNzd: 15000, implementationAttachRate: 0.3, implementationAvgNzd: 3500, recurringAttachRate: 0.3, recurringMonthlyNzd: 450, recurringMonths: 12, deliveryHoursPerOperator: 22, sharedDeliveryHours: 60, hourlyCostNzd: 110, softwareMonthlyNzd: 180, programmeMonths: 3, otherFixedCostsNzd: 2500, notes: "Illustrative assumptions — replace with your own." },
      { name: "Cohort 2: 15 operators @ $3.5k, no sponsor", cohortSize: 15, feePerOperatorNzd: 3500, implementationAttachRate: 0.4, implementationAvgNzd: 3500, recurringAttachRate: 0.35, recurringMonthlyNzd: 450, recurringMonths: 12, deliveryHoursPerOperator: 18, sharedDeliveryHours: 60, hourlyCostNzd: 110, softwareMonthlyNzd: 250, programmeMonths: 3, otherFixedCostsNzd: 3500, notes: "Assumes reusable templates cut per-operator hours. Illustrative." },
    ],
  });
}
