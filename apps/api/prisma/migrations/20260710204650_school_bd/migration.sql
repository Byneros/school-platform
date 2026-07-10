-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'TEACHER', 'PARENT', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SENT');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvaluationAspect" AS ENUM ('COGNITIVE', 'PERSONAL', 'SOCIAL');

-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('ACADEMIC', 'DISCIPLINARY', 'COEXISTENCE');

-- CreateEnum
CREATE TYPE "CoexistenceProtocol" AS ENUM ('TIPO_I', 'TIPO_II', 'TIPO_III');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('STUDY', 'ENROLLMENT');

-- CreateEnum
CREATE TYPE "CertificateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('OPINION', 'BUG', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'REVIEWED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PROMOTED', 'NOT_PROMOTED', 'PENDING');

-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('PRE_JARDIN', 'JARDIN', 'TRANSICION', 'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 'DECIMO', 'ONCE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenHash" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "geoCity" TEXT,
    "geoRegion" TEXT,
    "geoCountry" TEXT,
    "geoCountryCode" TEXT,
    "geoTimezone" TEXT,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalProfile" TEXT,
    "subjects" JSONB,
    "subjectHours" JSONB,
    "subjectHoursMode" JSONB,
    "subjectSchedules" JSONB,
    "cognitiveWeight" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "personalWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "socialWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gradeLevel" "GradeLevel" NOT NULL,
    "studentGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentObservation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ObservationType" NOT NULL,
    "coexistenceProtocol" "CoexistenceProtocol",
    "coexistenceOffense" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpCompleted" BOOLEAN NOT NULL DEFAULT false,
    "followUpCompletedAt" TIMESTAMP(3),
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateIssue" (
    "id" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "serial" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "AcademicClosureResult" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "finalAverage" DOUBLE PRECISION NOT NULL,
    "totalSubjects" INTEGER NOT NULL,
    "failedSubjects" INTEGER NOT NULL,
    "status" "PromotionStatus" NOT NULL,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT NOT NULL,

    CONSTRAINT "AcademicClosureResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "enrollmentDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "documents" JSONB,
    "studentFullName" TEXT,
    "studentBirthDate" TIMESTAMP(3),
    "studentBirthPlaceDept" TEXT,
    "studentBirthPlaceCity" TEXT,
    "studentGender" TEXT,
    "studentDocType" TEXT,
    "studentDocNumber" TEXT,
    "studentAddress" TEXT,
    "guardianFullName" TEXT,
    "guardianDocType" TEXT,
    "guardianDocNumber" TEXT,
    "guardianRelation" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "schedule" JSONB,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "admissionId" TEXT,
    "studentFullName" TEXT NOT NULL,
    "studentBirthDate" TIMESTAMP(3),
    "studentBirthPlaceDept" TEXT,
    "studentBirthPlaceCity" TEXT,
    "studentGender" TEXT,
    "studentDocType" TEXT,
    "studentDocNumber" TEXT,
    "studentGradeLevel" "GradeLevel" NOT NULL,
    "studentAddress" TEXT,
    "guardianFullName" TEXT NOT NULL,
    "guardianDocType" TEXT,
    "guardianDocNumber" TEXT NOT NULL,
    "guardianRelation" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "documents" JSONB,
    "documentsNotes" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aspect" "EvaluationAspect" NOT NULL DEFAULT 'COGNITIVE',
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "group" TEXT,
    "period" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "aspect" "EvaluationAspect" NOT NULL DEFAULT 'COGNITIVE',
    "maxScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskScore" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "studentId" TEXT,
    "targetUserId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_category_createdAt_idx" ON "Feedback"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");

-- CreateIndex
CREATE INDEX "Student_gradeLevel_studentGroup_idx" ON "Student"("gradeLevel", "studentGroup");

-- CreateIndex
CREATE INDEX "Student_fullName_idx" ON "Student"("fullName");

-- CreateIndex
CREATE INDEX "StudentObservation_studentId_date_idx" ON "StudentObservation"("studentId", "date");

-- CreateIndex
CREATE INDEX "StudentObservation_type_date_idx" ON "StudentObservation"("type", "date");

-- CreateIndex
CREATE INDEX "StudentObservation_createdById_createdAt_idx" ON "StudentObservation"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "StudentObservation_followUpDate_followUpCompleted_idx" ON "StudentObservation"("followUpDate", "followUpCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateIssue_code_key" ON "CertificateIssue"("code");

-- CreateIndex
CREATE INDEX "CertificateIssue_studentId_issuedAt_idx" ON "CertificateIssue"("studentId", "issuedAt");

-- CreateIndex
CREATE INDEX "CertificateIssue_issuedById_issuedAt_idx" ON "CertificateIssue"("issuedById", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateIssue_type_year_serial_key" ON "CertificateIssue"("type", "year", "serial");

-- CreateIndex
CREATE INDEX "CertificateRequest_status_requestedAt_idx" ON "CertificateRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "CertificateRequest_studentId_requestedAt_idx" ON "CertificateRequest"("studentId", "requestedAt");

-- CreateIndex
CREATE INDEX "CertificateRequest_requestedById_requestedAt_idx" ON "CertificateRequest"("requestedById", "requestedAt");

-- CreateIndex
CREATE INDEX "AcademicClosureResult_year_status_idx" ON "AcademicClosureResult"("year", "status");

-- CreateIndex
CREATE INDEX "AcademicClosureResult_closedById_closedAt_idx" ON "AcademicClosureResult"("closedById", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClosureResult_year_enrollmentId_key" ON "AcademicClosureResult"("year", "enrollmentId");

-- CreateIndex
CREATE INDEX "Admission_status_createdAt_idx" ON "Admission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_parentId_studentId_key" ON "Guardian"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_admissionId_key" ON "Enrollment"("admissionId");

-- CreateIndex
CREATE INDEX "Enrollment_classId_year_status_idx" ON "Enrollment"("classId", "year", "status");

-- CreateIndex
CREATE INDEX "Enrollment_studentGradeLevel_year_idx" ON "Enrollment"("studentGradeLevel", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_classId_year_key" ON "Enrollment"("studentId", "classId", "year");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Attendance_status_date_idx" ON "Attendance"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_enrollmentId_date_key" ON "Attendance"("enrollmentId", "date");

-- CreateIndex
CREATE INDEX "Grade_period_aspect_createdAt_idx" ON "Grade"("period", "aspect", "createdAt");

-- CreateIndex
CREATE INDEX "Task_teacherId_gradeLevel_group_period_idx" ON "Task"("teacherId", "gradeLevel", "group", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Task_teacherId_gradeLevel_group_period_title_aspect_key" ON "Task"("teacherId", "gradeLevel", "group", "period", "title", "aspect");

-- CreateIndex
CREATE INDEX "TaskScore_enrollmentId_idx" ON "TaskScore"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskScore_taskId_enrollmentId_key" ON "TaskScore"("taskId", "enrollmentId");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdById_status_idx" ON "Notification"("createdById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_parentId_key" ON "NotificationRecipient"("notificationId", "parentId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClosureResult" ADD CONSTRAINT "AcademicClosureResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClosureResult" ADD CONSTRAINT "AcademicClosureResult_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScore" ADD CONSTRAINT "TaskScore_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScore" ADD CONSTRAINT "TaskScore_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
