-- Findable: read-only audit of user-to-business links (leftover access from
-- revoked or re-invited invitations). ONE SELECT statement, so nothing is
-- written. Reads only:
--   "User"         id, email (masked in the output), role, status, whether a
--                  password is set (true/false only, never the hash), operatorId
--   "UserBusiness" userId, operatorId, createdAt
--   "Operator"     id, name
--   "AuditLog"     action, entityType, entityId, changes (businessIds /
--                  operatorId only), createdAt, for rows with action
--                  user.invite or user.business_link
-- It does not read password hashes, sessions, tokens or any business content.
--
-- Output: one row per finding:
--   finding, user_id, email_masked, role, status, activated, business_id,
--   business_name, linked_at, detail
-- Findings:
--   A  An account that never set a password and is NOT an outstanding
--      invitation still holds a business link. Covers every status a revoked
--      invitation can end up in: ARCHIVED (revoked), SUSPENDED (revoked, then
--      suspended by an admin) and ACTIVE-without-password (only possible if the
--      previous app version's legacy "active" flag was written). This is what
--      a revoked invitation left behind before the fix.
--   B  A link that the account's latest invitation didn't include and no later
--      explicit "link business" action added. This is possible leftover access
--      after a re-invite.
--   C  An operator linked to more than one business. Often legitimate; listed
--      for review.
--   D  An operator whose current business is not one of their links.
--      Harmless (the app ignores it) but worth tidying.
--   P  An outstanding invitation (PENDING, no password) and the business it
--      will grant. Not a defect: listed so you can confirm each is intended.

WITH latest_invite AS (
  SELECT DISTINCT ON (a."entityId")
         a."entityId" AS user_id, a."createdAt" AS invited_at,
         COALESCE(a.changes -> 'businessIds', '[]'::jsonb) AS business_ids
  FROM "AuditLog" a
  WHERE a.action = 'user.invite' AND a."entityType" = 'user'
  ORDER BY a."entityId", a."createdAt" DESC
),
linked_after AS (
  SELECT a."entityId" AS user_id, a.changes ->> 'operatorId' AS operator_id, a."createdAt"
  FROM "AuditLog" a
  WHERE a.action = 'user.business_link' AND a."entityType" = 'user'
),
links AS (
  SELECT ub."userId" AS user_id, ub."operatorId" AS business_id, ub."createdAt" AS linked_at,
         u.email, u.role::text AS role, u.status::text AS status, (u."passwordHash" IS NOT NULL) AS activated,
         u."operatorId" AS current_business, o.name AS business_name
  FROM "UserBusiness" ub
  JOIN "User" u ON u.id = ub."userId"
  JOIN "Operator" o ON o.id = ub."operatorId"
),
masked AS (
  SELECT l.*, left(l.email, 1) || '***@' || split_part(l.email, '@', 2) AS email_masked FROM links l
)
SELECT 'A: never-activated account still linked' AS finding, m.user_id, m.email_masked, m.role, m.status, m.activated,
       m.business_id, m.business_name, m."linked_at", 'Remove the link, or re-invite with the correct business' AS detail
FROM masked m
WHERE NOT m.activated AND m.status <> 'PENDING'
UNION ALL
SELECT 'P: outstanding invitation (review)', m.user_id, m.email_masked, m.role, m.status, m.activated,
       m.business_id, m.business_name, m."linked_at", 'Confirm this invitation is still wanted, for this business'
FROM masked m
WHERE NOT m.activated AND m.status = 'PENDING'
UNION ALL
SELECT 'B: link not in latest invitation', m.user_id, m.email_masked, m.role, m.status, m.activated,
       m.business_id, m.business_name, m."linked_at",
       'Latest invitation ' || to_char(li.invited_at, 'YYYY-MM-DD HH24:MI') || ' was for ' || li.business_ids::text
FROM masked m
JOIN latest_invite li ON li.user_id = m.user_id
WHERE NOT (li.business_ids @> to_jsonb(m.business_id))
  AND NOT EXISTS (SELECT 1 FROM linked_after la
                  WHERE la.user_id = m.user_id AND la.operator_id = m.business_id AND la."createdAt" >= li.invited_at)
UNION ALL
SELECT 'C: operator linked to several businesses', m.user_id, m.email_masked, m.role, m.status, m.activated,
       m.business_id, m.business_name, m."linked_at", 'Confirm this person should see each business'
FROM masked m
WHERE m.role = 'OPERATOR' AND (SELECT count(*) FROM "UserBusiness" x WHERE x."userId" = m.user_id) > 1
UNION ALL
SELECT 'D: current business is not a membership', u.id, left(u.email, 1) || '***@' || split_part(u.email, '@', 2),
       u.role::text, u.status::text, (u."passwordHash" IS NOT NULL), u."operatorId", o.name, NULL, 'Ignored by the app; tidy up'
FROM "User" u
LEFT JOIN "Operator" o ON o.id = u."operatorId"
WHERE u.role = 'OPERATOR' AND u."operatorId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "UserBusiness" x WHERE x."userId" = u.id AND x."operatorId" = u."operatorId")
ORDER BY 1, 2, 7;
