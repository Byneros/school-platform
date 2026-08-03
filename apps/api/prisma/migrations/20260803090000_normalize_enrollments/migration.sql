ALTER TABLE "Enrollment"
  ADD COLUMN IF NOT EXISTS "campus" TEXT,
  ADD COLUMN IF NOT EXISTS "shift" TEXT,
  ADD COLUMN IF NOT EXISTS "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "studentGroup" TEXT;

ALTER TABLE "Enrollment"
  ALTER COLUMN "studentFullName" DROP NOT NULL;

UPDATE "Enrollment" e
SET
  "studentGroup" = COALESCE(e."studentGroup", s."studentGroup"),
  "studentDocType" = COALESCE(e."studentDocType", s."documentType"),
  "studentDocNumber" = COALESCE(e."studentDocNumber", s."documentNumber"),
  "studentFullName" = COALESCE(e."studentFullName", s."fullName"),
  "studentBirthDate" = COALESCE(e."studentBirthDate", s."birthDate")
FROM "Student" s
WHERE e."studentId" = s."id";

CREATE INDEX IF NOT EXISTS "Enrollment_studentId_year_idx" ON "Enrollment"("studentId", "year");
CREATE INDEX IF NOT EXISTS "Enrollment_studentGroup_year_idx" ON "Enrollment"("studentGroup", "year");
