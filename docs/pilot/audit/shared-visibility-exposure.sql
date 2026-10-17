-- Findable: read-only. Has the shared-visibility defect (fixed on branch
-- claude/pilot-p0-shared-visibility) actually exposed anything in this
-- database? Counts only: no titles, names or emails. One SELECT; no writes.
--
-- Before the fix, every client portal showed other businesses' experiments
-- marked COHORT, AGGREGATE_APPROVED or PUBLIC_APPROVED (overview), and the
-- Growth Collective showed such learnings from any business. Exposure needed
-- (1) such records owned by a business and (2) another business with a
-- client user who could sign in.
--
-- Reads: "Experiment" and "Learning" (operatorId, visibility, culturalReview
-- for learnings); "Operator" (id, programmeId); "UserBusiness" and "User"
-- (role, status, whether a password is set) for counts.
WITH shared AS (
  SELECT 'experiment' AS record_type, e."operatorId", e.visibility::text AS visibility
  FROM "Experiment" e
  WHERE e."operatorId" IS NOT NULL AND e.visibility IN ('COHORT', 'AGGREGATE_APPROVED', 'PUBLIC_APPROVED')
  UNION ALL
  SELECT 'learning', l."operatorId", l.visibility::text
  FROM "Learning" l
  WHERE l."operatorId" IS NOT NULL AND l.visibility IN ('COHORT', 'AGGREGATE_APPROVED', 'PUBLIC_APPROVED')
    AND l."culturalReview" <> 'REQUIRED'
),
viewers AS (
  SELECT DISTINCT ub."operatorId", o."programmeId"
  FROM "UserBusiness" ub
  JOIN "User" u ON u.id = ub."userId"
  JOIN "Operator" o ON o.id = ub."operatorId"
  WHERE u.role = 'OPERATOR' AND u.status = 'ACTIVE' AND u."passwordHash" IS NOT NULL
)
SELECT s.record_type,
       s.visibility,
       count(*)                                                         AS records,
       count(DISTINCT s."operatorId")                                   AS owning_businesses,
       -- other businesses with a sign-in-capable client user (could see it before the fix)
       (SELECT count(*) FROM viewers v WHERE v."operatorId" NOT IN (SELECT DISTINCT "operatorId" FROM shared s2
          WHERE s2.record_type = s.record_type AND s2.visibility = s.visibility)) AS other_businesses_with_users,
       -- of those, how many are outside every owner's programme (still not entitled after the fix)
       (SELECT count(*) FROM viewers v WHERE NOT EXISTS (
          SELECT 1 FROM shared s3 JOIN "Operator" o ON o.id = s3."operatorId"
          WHERE s3.record_type = s.record_type AND s3.visibility = s.visibility
            AND v."programmeId" IS NOT NULL AND o."programmeId" = v."programmeId")) AS viewers_outside_owners_programmes
FROM shared s
GROUP BY s.record_type, s.visibility
ORDER BY s.record_type, s.visibility;
