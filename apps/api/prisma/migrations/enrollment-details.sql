-- AlterTable
ALTER TABLE "Admission" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "documentsNotes" TEXT,
ADD COLUMN     "guardianDocNumber" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "guardianDocType" TEXT,
ADD COLUMN     "guardianFullName" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "guardianRelation" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "studentAddress" TEXT,
ADD COLUMN     "studentBirthDate" TIMESTAMP(3),
ADD COLUMN     "studentBirthPlaceCity" TEXT,
ADD COLUMN     "studentBirthPlaceDept" TEXT,
ADD COLUMN     "studentDocNumber" TEXT,
ADD COLUMN     "studentDocType" TEXT,
ADD COLUMN     "studentFullName" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "studentGender" TEXT,
ADD COLUMN     "studentGradeLevel" "GradeLevel" NOT NULL DEFAULT 'PRE_JARDIN';
