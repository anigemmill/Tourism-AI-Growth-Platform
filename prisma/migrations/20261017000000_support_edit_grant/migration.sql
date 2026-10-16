-- Support view: Super Admin "edit on behalf of a client" grants.
--
-- Additive only: one new table, no changes to existing tables or data.
-- A grant is bound to one sign-in session (deleted with it) and one
-- business, expires, and can be revoked. Rolling back the application
-- leaves this table unused and harmless.
-- CreateTable
CREATE TABLE "SupportEditGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SupportEditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportEditGrant_sessionId_operatorId_idx" ON "SupportEditGrant"("sessionId", "operatorId");

-- CreateIndex
CREATE INDEX "SupportEditGrant_userId_idx" ON "SupportEditGrant"("userId");

-- AddForeignKey
ALTER TABLE "SupportEditGrant" ADD CONSTRAINT "SupportEditGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportEditGrant" ADD CONSTRAINT "SupportEditGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportEditGrant" ADD CONSTRAINT "SupportEditGrant_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same Data API lock-down as every other table (see 20261015090000_enable_rls).
ALTER TABLE "SupportEditGrant" ENABLE ROW LEVEL SECURITY;
