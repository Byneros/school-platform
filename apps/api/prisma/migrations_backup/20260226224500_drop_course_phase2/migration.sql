-- Phase 2: remove legacy Course relation and keep Class as grade-based entity.

-- Safety backfill before enforcing NOT NULL.
UPDATE "Class" c
SET "gradeLevel" = cr."gradeLevel"
FROM "Course" cr
WHERE c."courseId" = cr."id"
  AND c."gradeLevel" IS NULL;

UPDATE "Class"
SET "gradeLevel" = 'PRIMERO'::"GradeLevel"
WHERE "gradeLevel" IS NULL;

ALTER TABLE "Class"
  ALTER COLUMN "gradeLevel" SET NOT NULL;

ALTER TABLE "Class"
  DROP CONSTRAINT IF EXISTS "Class_courseId_fkey";

ALTER TABLE "Class"
  DROP COLUMN IF EXISTS "courseId";

DROP TABLE IF EXISTS "Course";
