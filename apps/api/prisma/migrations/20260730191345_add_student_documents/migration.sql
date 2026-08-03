/*
  Warnings:

  - A unique constraint covering the columns `[documentNumber]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_documentNumber_key" ON "Student"("documentNumber");
