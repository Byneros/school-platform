CREATE TYPE "CertificateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CertificateRequest" (
    "id" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "status" "CertificateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "studentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CertificateRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CertificateRequest_status_requestedAt_idx" ON "CertificateRequest"("status", "requestedAt");
CREATE INDEX "CertificateRequest_studentId_requestedAt_idx" ON "CertificateRequest"("studentId", "requestedAt");
CREATE INDEX "CertificateRequest_requestedById_requestedAt_idx" ON "CertificateRequest"("requestedById", "requestedAt");
