-- Add follow-up tracking to student observations
ALTER TABLE "StudentObservation" ADD COLUMN "followUpDate" TIMESTAMP(3);
ALTER TABLE "StudentObservation" ADD COLUMN "followUpCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentObservation" ADD COLUMN "followUpCompletedAt" TIMESTAMP(3);

CREATE INDEX "StudentObservation_followUpDate_followUpCompleted_idx" ON "StudentObservation"("followUpDate", "followUpCompleted");
