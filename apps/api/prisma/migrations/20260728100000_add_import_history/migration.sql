-- CreateTable
CREATE TABLE "ImportHistory" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdByEmail" TEXT,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "warnings" JSONB,
  "errors" JSONB,

  CONSTRAINT "ImportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportHistory_createdAt_idx" ON "ImportHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ImportHistory_createdById_createdAt_idx" ON "ImportHistory"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ImportHistory_mode_status_createdAt_idx" ON "ImportHistory"("mode", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
