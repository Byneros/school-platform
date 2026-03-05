DO $$ BEGIN
  CREATE TYPE "GradeLevel" AS ENUM (
    'PRE_JARDIN','JARDIN','TRANSICION','PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','SEPTIMO','OCTAVO','NOVENO','DECIMO','ONCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gradeLevel_new" "GradeLevel";
UPDATE "Student" SET "gradeLevel_new" = CASE "gradeLevel"
  WHEN 'PRE_JARDIN' THEN 'PRE_JARDIN'::"GradeLevel"
  WHEN 'JARDIN' THEN 'JARDIN'::"GradeLevel"
  WHEN 'TRANSICION' THEN 'TRANSICION'::"GradeLevel"
  WHEN 'PRIMERO' THEN 'PRIMERO'::"GradeLevel"
  WHEN 'SEGUNDO' THEN 'SEGUNDO'::"GradeLevel"
  WHEN 'TERCERO' THEN 'TERCERO'::"GradeLevel"
  WHEN 'CUARTO' THEN 'CUARTO'::"GradeLevel"
  WHEN 'QUINTO' THEN 'QUINTO'::"GradeLevel"
  WHEN 'SEXTO' THEN 'SEXTO'::"GradeLevel"
  WHEN 'SEPTIMO' THEN 'SEPTIMO'::"GradeLevel"
  WHEN 'OCTAVO' THEN 'OCTAVO'::"GradeLevel"
  WHEN 'NOVENO' THEN 'NOVENO'::"GradeLevel"
  WHEN 'DECIMO' THEN 'DECIMO'::"GradeLevel"
  WHEN 'ONCE' THEN 'ONCE'::"GradeLevel"
  WHEN '1' THEN 'PRIMERO'::"GradeLevel"
  WHEN '2' THEN 'SEGUNDO'::"GradeLevel"
  WHEN '3' THEN 'TERCERO'::"GradeLevel"
  WHEN '4' THEN 'CUARTO'::"GradeLevel"
  WHEN '5' THEN 'QUINTO'::"GradeLevel"
  WHEN '6' THEN 'SEXTO'::"GradeLevel"
  WHEN '7' THEN 'SEPTIMO'::"GradeLevel"
  WHEN '8' THEN 'OCTAVO'::"GradeLevel"
  WHEN '9' THEN 'NOVENO'::"GradeLevel"
  WHEN '10' THEN 'DECIMO'::"GradeLevel"
  WHEN '11' THEN 'ONCE'::"GradeLevel"
  ELSE 'QUINTO'::"GradeLevel"
END;
ALTER TABLE "Student" DROP COLUMN "gradeLevel";
ALTER TABLE "Student" RENAME COLUMN "gradeLevel_new" TO "gradeLevel";
ALTER TABLE "Student" ALTER COLUMN "gradeLevel" SET NOT NULL;

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "gradeLevel_new" "GradeLevel";
UPDATE "Course" SET "gradeLevel_new" = CASE "gradeLevel"
  WHEN 'PRE_JARDIN' THEN 'PRE_JARDIN'::"GradeLevel"
  WHEN 'JARDIN' THEN 'JARDIN'::"GradeLevel"
  WHEN 'TRANSICION' THEN 'TRANSICION'::"GradeLevel"
  WHEN 'PRIMERO' THEN 'PRIMERO'::"GradeLevel"
  WHEN 'SEGUNDO' THEN 'SEGUNDO'::"GradeLevel"
  WHEN 'TERCERO' THEN 'TERCERO'::"GradeLevel"
  WHEN 'CUARTO' THEN 'CUARTO'::"GradeLevel"
  WHEN 'QUINTO' THEN 'QUINTO'::"GradeLevel"
  WHEN 'SEXTO' THEN 'SEXTO'::"GradeLevel"
  WHEN 'SEPTIMO' THEN 'SEPTIMO'::"GradeLevel"
  WHEN 'OCTAVO' THEN 'OCTAVO'::"GradeLevel"
  WHEN 'NOVENO' THEN 'NOVENO'::"GradeLevel"
  WHEN 'DECIMO' THEN 'DECIMO'::"GradeLevel"
  WHEN 'ONCE' THEN 'ONCE'::"GradeLevel"
  WHEN '1' THEN 'PRIMERO'::"GradeLevel"
  WHEN '2' THEN 'SEGUNDO'::"GradeLevel"
  WHEN '3' THEN 'TERCERO'::"GradeLevel"
  WHEN '4' THEN 'CUARTO'::"GradeLevel"
  WHEN '5' THEN 'QUINTO'::"GradeLevel"
  WHEN '6' THEN 'SEXTO'::"GradeLevel"
  WHEN '7' THEN 'SEPTIMO'::"GradeLevel"
  WHEN '8' THEN 'OCTAVO'::"GradeLevel"
  WHEN '9' THEN 'NOVENO'::"GradeLevel"
  WHEN '10' THEN 'DECIMO'::"GradeLevel"
  WHEN '11' THEN 'ONCE'::"GradeLevel"
  ELSE 'QUINTO'::"GradeLevel"
END;
ALTER TABLE "Course" DROP COLUMN "gradeLevel";
ALTER TABLE "Course" RENAME COLUMN "gradeLevel_new" TO "gradeLevel";
ALTER TABLE "Course" ALTER COLUMN "gradeLevel" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "Admission" (
  "id" TEXT PRIMARY KEY,
  "studentName" TEXT NOT NULL,
  "gradeLevel" "GradeLevel" NOT NULL,
  "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "notes" TEXT
);

ALTER TABLE "Admission"
  ADD COLUMN IF NOT EXISTS "documents" JSONB;

-- Phase 2: eliminar Course y courseId, dejando Class basado en gradeLevel.
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

-- Phase 3: Observador del estudiante
DO $$ BEGIN
  CREATE TYPE "ObservationType" AS ENUM ('ACADEMIC','DISCIPLINARY','COEXISTENCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudentObservation" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "type" "ObservationType" NOT NULL,
  "detail" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE "StudentObservation"
    ADD CONSTRAINT "StudentObservation_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudentObservation"
    ADD CONSTRAINT "StudentObservation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "StudentObservation_studentId_date_idx" ON "StudentObservation" ("studentId", "date");
CREATE INDEX IF NOT EXISTS "StudentObservation_type_date_idx" ON "StudentObservation" ("type", "date");
CREATE INDEX IF NOT EXISTS "StudentObservation_createdById_createdAt_idx" ON "StudentObservation" ("createdById", "createdAt");

-- Phase 4: Trazabilidad de certificados
DO $$ BEGIN
  CREATE TYPE "CertificateType" AS ENUM ('STUDY','ENROLLMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CertificateIssue" (
  "id" TEXT PRIMARY KEY,
  "type" "CertificateType" NOT NULL,
  "serial" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "studentId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "issuedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE "CertificateIssue"
    ADD CONSTRAINT "CertificateIssue_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CertificateIssue"
    ADD CONSTRAINT "CertificateIssue_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CertificateIssue_type_year_serial_key" ON "CertificateIssue" ("type", "year", "serial");
CREATE INDEX IF NOT EXISTS "CertificateIssue_studentId_issuedAt_idx" ON "CertificateIssue" ("studentId", "issuedAt");
CREATE INDEX IF NOT EXISTS "CertificateIssue_issuedById_issuedAt_idx" ON "CertificateIssue" ("issuedById", "issuedAt");

-- Phase 5: Cierre academico y promocion
DO $$ BEGIN
  CREATE TYPE "PromotionStatus" AS ENUM ('PROMOTED','NOT_PROMOTED','PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AcademicClosureResult" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "finalAverage" DOUBLE PRECISION NOT NULL,
  "totalSubjects" INTEGER NOT NULL,
  "failedSubjects" INTEGER NOT NULL,
  "status" "PromotionStatus" NOT NULL,
  "notes" TEXT,
  "closedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "closedById" TEXT NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "AcademicClosureResult"
    ADD CONSTRAINT "AcademicClosureResult_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademicClosureResult"
    ADD CONSTRAINT "AcademicClosureResult_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicClosureResult_year_enrollmentId_key" ON "AcademicClosureResult" ("year", "enrollmentId");
CREATE INDEX IF NOT EXISTS "AcademicClosureResult_year_status_idx" ON "AcademicClosureResult" ("year", "status");
CREATE INDEX IF NOT EXISTS "AcademicClosureResult_closedById_closedAt_idx" ON "AcademicClosureResult" ("closedById", "closedAt");
