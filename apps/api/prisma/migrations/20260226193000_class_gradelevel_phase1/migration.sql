-- Phase 1 (non-breaking):
-- Add a direct gradeLevel column on Class to progressively decouple runtime
-- semantics from Course while keeping courseId for compatibility.

ALTER TABLE "Class"
ADD COLUMN IF NOT EXISTS "gradeLevel" "GradeLevel";

UPDATE "Class" c
SET "gradeLevel" = cr."gradeLevel"
FROM "Course" cr
WHERE c."courseId" = cr."id"
  AND c."gradeLevel" IS NULL;

CREATE INDEX IF NOT EXISTS "Class_gradeLevel_idx"
ON "Class"("gradeLevel");
