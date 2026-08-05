-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "schoolId" TEXT;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
