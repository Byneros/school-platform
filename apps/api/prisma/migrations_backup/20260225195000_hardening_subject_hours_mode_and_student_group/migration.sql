-- Hardening migration: keep schema compatible across old/new databases.
-- This migration is intentionally idempotent to support environments with drift.

ALTER TABLE "Teacher"
ADD COLUMN IF NOT EXISTS "subjectHours" JSONB,
ADD COLUMN IF NOT EXISTS "subjectSchedules" JSONB,
ADD COLUMN IF NOT EXISTS "subjectHoursMode" JSONB;

ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "studentGroup" TEXT;

UPDATE "Teacher"
SET
  "subjectHours" = COALESCE("subjectHours", '{}'::jsonb),
  "subjectSchedules" = COALESCE("subjectSchedules", '{}'::jsonb),
  "subjectHoursMode" = COALESCE("subjectHoursMode", '{}'::jsonb)
WHERE
  "subjectHours" IS NULL
  OR "subjectSchedules" IS NULL
  OR "subjectHoursMode" IS NULL;