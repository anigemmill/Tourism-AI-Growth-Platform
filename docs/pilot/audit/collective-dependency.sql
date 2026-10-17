-- Findable: read-only. Growth Collective access per business: what each
-- business's users get today, and what they would get once the readiness
-- branch is released. One SELECT statement; no writes.
--
-- How access is decided (from the code):
--   * An explicit BusinessFeature row for 'portal.collective' always wins
--     (enabled = true/false), today and after the release.
--   * With no row, the default applies:
--       today (main, live):             ON  (FEATURES default)
--       after the readiness branch:     OFF for the Findable brand, which is
--                                       what Production runs (PRODUCT_BRAND=findable)
--   So only businesses WITHOUT an explicit row change, and only from on to off.
--
-- Reads:
--   "Operator"        id, name, status, accountStatus, programmeId (as true/false)
--   "BusinessFeature" operatorId, feature, enabled (portal.collective only)
--   "UserBusiness"    userId, operatorId   } counts only: client users who can
--   "User"            id, role, status,    } sign in today (ACTIVE with a password
--                     passwordHash         } set; tested only for NULL, never
--                                          } read). No names or emails.
--
-- Output: one row per business, those whose access would change listed first.
SELECT o.id,
       o.name,
       o."accountStatus"::text                  AS account_status,
       o.status::text                           AS programme_status,
       (o."programmeId" IS NOT NULL)            AS in_programme,
       f.enabled                                AS explicit_setting,   -- NULL = none, default applies
       COALESCE(f.enabled, true)                AS collective_now,
       COALESCE(f.enabled, false)               AS collective_after_release,
       (f.enabled IS NULL)                      AS access_changes,     -- true = on now, off after release
       (SELECT count(*)
          FROM "UserBusiness" ub
          JOIN "User" u ON u.id = ub."userId"
         WHERE ub."operatorId" = o.id AND u.role = 'OPERATOR' AND u.status = 'ACTIVE'
           AND u."passwordHash" IS NOT NULL) AS active_client_users
FROM "Operator" o
LEFT JOIN "BusinessFeature" f ON f."operatorId" = o.id AND f.feature = 'portal.collective'
ORDER BY access_changes DESC, active_client_users DESC, o.name;
