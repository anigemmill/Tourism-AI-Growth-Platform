-- Findable pilot: weekly success measures per business. Read-only, one
-- SELECT; counts and dates only (no names of people, no emails).
-- Reads: Operator (id, name, isSynthetic), UserBusiness, User (role, status,
-- passwordHash IS NULL test, lastLoginAt, createdAt), LoginAttempt (email,
-- success, createdAt; matched to users only to count sign-ins),
-- Task (status, visibility), GrowthBrief (status, weekOf), Signal
-- (submittedByOperator, createdAt).
WITH clients AS (
  SELECT ub."operatorId", u.id AS user_id, u.email, u.status::text AS status,
         (u."passwordHash" IS NOT NULL) AS activated, u."lastLoginAt", u."createdAt"
  FROM "UserBusiness" ub JOIN "User" u ON u.id = ub."userId"
  WHERE u.role = 'OPERATOR'
)
SELECT o.name                                                                    AS business,
       (SELECT count(*) FROM clients c WHERE c."operatorId" = o.id)              AS client_users_invited,
       (SELECT count(*) FROM clients c WHERE c."operatorId" = o.id AND c.activated) AS client_users_activated,
       (SELECT max(c."lastLoginAt") FROM clients c WHERE c."operatorId" = o.id)  AS last_client_sign_in,
       (SELECT count(*) FROM "LoginAttempt" la JOIN clients c ON lower(c.email) = la.email
         WHERE c."operatorId" = o.id AND la.success AND la."createdAt" > now() - interval '7 days') AS client_sign_ins_7d,
       (SELECT count(*) FROM "GrowthBrief" b WHERE b."operatorId" = o.id AND b.status = 'SHARED') AS briefs_shared,
       (SELECT max(b."weekOf") FROM "GrowthBrief" b WHERE b."operatorId" = o.id AND b.status = 'SHARED') AS last_brief_week,
       (SELECT count(*) FROM "Task" t WHERE t."operatorId" = o.id AND t.visibility <> 'INTERNAL')            AS client_actions,
       (SELECT count(*) FROM "Task" t WHERE t."operatorId" = o.id AND t.visibility <> 'INTERNAL' AND t.status = 'DONE') AS client_actions_done,
       (SELECT count(*) FROM "Signal" s WHERE s."operatorId" = o.id AND s."submittedByOperator")            AS updates_from_client
FROM "Operator" o
WHERE NOT o."isSynthetic"
ORDER BY o.name;
