-- Backfill legacy ADMIN users when the database has a single unambiguous school.
UPDATE "User"
SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "role" = 'ADMIN'
  AND "schoolId" IS NULL
  AND (SELECT COUNT(*) FROM "School") = 1;
