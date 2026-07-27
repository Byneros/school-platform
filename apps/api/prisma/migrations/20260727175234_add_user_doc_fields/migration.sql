/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[docType,docNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Adds `updatedAt` to the `User` table in a backwards-compatible way for databases with existing rows.

*/
-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('CC', 'TI', 'CE', 'PASSPORT', 'NIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Student_fullName_idx";

-- DropIndex
DROP INDEX IF EXISTS "Student_gradeLevel_studentGroup_idx";

-- DropIndex
DROP INDEX IF EXISTS "User_role_isActive_idx";

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "academicYear" DROP DEFAULT,
ALTER COLUMN "studentGroup" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "docNumber" TEXT,
ADD COLUMN IF NOT EXISTS "docType" "DocumentType",
ADD COLUMN IF NOT EXISTS "gender" "Gender",
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Backfill existing users before enforcing the NOT NULL constraint.
UPDATE "User"
SET "updatedAt" = COALESCE("createdAt", NOW())
WHERE "updatedAt" IS NULL;

ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_docType_docNumber_key" ON "User"("docType", "docNumber");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Student_userId_fkey'
  ) THEN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
