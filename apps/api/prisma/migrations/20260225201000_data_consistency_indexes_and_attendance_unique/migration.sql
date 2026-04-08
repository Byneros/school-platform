-- Step 9: Data consistency and query performance hardening.
-- Safe/idempotent migration for existing environments with data.

-- 1) Deduplicate attendance by (enrollmentId, date) keeping one row.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "enrollmentId", "date"
      ORDER BY "id" DESC
    ) AS rn
  FROM "Attendance"
)
DELETE FROM "Attendance" a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

-- 2) Unique attendance per student enrollment per day (date normalized by app).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attendance_enrollmentId_date_key'
  ) THEN
    ALTER TABLE "Attendance"
    ADD CONSTRAINT "Attendance_enrollmentId_date_key"
    UNIQUE ("enrollmentId", "date");
  END IF;
END $$;

-- 3) Supporting indexes for common filters/search.
CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX IF NOT EXISTS "Student_gradeLevel_studentGroup_idx" ON "Student"("gradeLevel", "studentGroup");
CREATE INDEX IF NOT EXISTS "Student_fullName_idx" ON "Student"("fullName");
CREATE INDEX IF NOT EXISTS "Admission_status_createdAt_idx" ON "Admission"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Enrollment_classId_year_status_idx" ON "Enrollment"("classId", "year", "status");
CREATE INDEX IF NOT EXISTS "Enrollment_studentGradeLevel_year_idx" ON "Enrollment"("studentGradeLevel", "year");
CREATE INDEX IF NOT EXISTS "Attendance_date_idx" ON "Attendance"("date");
CREATE INDEX IF NOT EXISTS "Attendance_status_date_idx" ON "Attendance"("status", "date");
CREATE INDEX IF NOT EXISTS "Grade_period_aspect_createdAt_idx" ON "Grade"("period", "aspect", "createdAt");
CREATE INDEX IF NOT EXISTS "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_createdById_status_idx" ON "Notification"("createdById", "status");
