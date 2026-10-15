-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('LANDING_PAGE', 'BLOG', 'DESTINATION_GUIDE', 'FAQ', 'SOCIAL_POST', 'VIDEO', 'EMAIL', 'PR', 'COMPARISON', 'ITINERARY');

-- CreateEnum
CREATE TYPE "ContentBriefStatus" AS ENUM ('PROPOSED', 'APPROVED', 'IN_PROGRESS', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "competitorId" TEXT;

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "whyNow" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "seoNotes" TEXT,
    "aiDiscoveryNotes" TEXT,
    "status" "ContentBriefStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorProfile" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "positioning" TEXT,
    "differentiators" TEXT[],
    "pricingSummary" TEXT,
    "experiencesSummary" TEXT,
    "seasonalitySummary" TEXT,
    "faqs" JSONB,
    "bookingProcessSummary" TEXT,
    "currentContentSummary" TEXT,
    "analysisStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "analysisError" TEXT,
    "analysisConfidence" "ConfidenceLevel",
    "analyzedAt" TIMESTAMP(3),
    "analyzedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competitor_operatorId_idx" ON "Competitor"("operatorId");

-- CreateIndex
CREATE INDEX "ContentBrief_operatorId_status_idx" ON "ContentBrief"("operatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorProfile_operatorId_key" ON "OperatorProfile"("operatorId");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorProfile" ADD CONSTRAINT "OperatorProfile_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every table must have RLS enabled (see 20261015090000_enable_rls and
-- tests/integration/rls.test.ts) to keep Supabase's auto-generated Data API
-- locked out. The app connects as table owner and is unaffected.
ALTER TABLE "Competitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentBrief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorProfile" ENABLE ROW LEVEL SECURITY;
