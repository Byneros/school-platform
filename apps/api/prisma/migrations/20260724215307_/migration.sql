/*
  Warnings:

  - A unique constraint covering the columns `[teacherId,gradeLevel,studentGroup,academicYear]` on the table `Class` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYear` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentGroup` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "academicYear" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
ADD COLUMN     "studentGroup" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "Class_teacherId_gradeLevel_studentGroup_academicYear_key" ON "Class"("teacherId", "gradeLevel", "studentGroup", "academicYear");
