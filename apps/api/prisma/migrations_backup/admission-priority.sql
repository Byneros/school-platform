-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "enrollmentDueAt" TIMESTAMP(3),
ADD COLUMN     "guardianDocNumber" TEXT,
ADD COLUMN     "guardianDocType" TEXT,
ADD COLUMN     "guardianFullName" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "studentAddress" TEXT,
ADD COLUMN     "studentBirthDate" TIMESTAMP(3),
ADD COLUMN     "studentBirthPlaceCity" TEXT,
ADD COLUMN     "studentBirthPlaceDept" TEXT,
ADD COLUMN     "studentDocNumber" TEXT,
ADD COLUMN     "studentDocType" TEXT,
ADD COLUMN     "studentFullName" TEXT,
ADD COLUMN     "studentGender" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "admissionId" TEXT,
ALTER COLUMN "contactPhone" DROP DEFAULT,
ALTER COLUMN "guardianDocNumber" DROP DEFAULT,
ALTER COLUMN "guardianFullName" DROP DEFAULT,
ALTER COLUMN "guardianRelation" DROP DEFAULT,
ALTER COLUMN "studentFullName" DROP DEFAULT,
ALTER COLUMN "studentGradeLevel" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_admissionId_key" ON "Enrollment"("admissionId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
