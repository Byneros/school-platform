ALTER TABLE "Notification" ADD COLUMN "targetUserId" TEXT;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_targetUserId_idx" ON "Notification"("targetUserId");
