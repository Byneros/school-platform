/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[docType,docNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CC', 'TI', 'CE', 'PASSPORT', 'NIT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- DropIndex
DROP INDEX "Student_fullName_idx";

-- DropIndex
DROP INDEX "Student_gradeLevel_studentGroup_idx";

-- DropIndex
DROP INDEX "User_role_isActive_idx";

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "academicYear" DROP DEFAULT,
ALTER COLUMN "studentGroup" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "docNumber" TEXT,
ADD COLUMN     "docType" "DocumentType",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_docType_docNumber_key" ON "User"("docType", "docNumber");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
