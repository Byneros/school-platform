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

-- CreateIndex
CREATE INDEX "Task_teacherId_gradeLevel_group_period_idx" ON "Task"("teacherId", "gradeLevel", "group", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Task_teacherId_gradeLevel_group_period_title_aspect_key" ON "Task"("teacherId", "gradeLevel", "group", "period", "title", "aspect");

-- CreateIndex
CREATE UNIQUE INDEX "TaskScore_taskId_enrollmentId_key" ON "TaskScore"("taskId", "enrollmentId");

-- CreateIndex
CREATE INDEX "TaskScore_enrollmentId_idx" ON "TaskScore"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScore" ADD CONSTRAINT "TaskScore_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScore" ADD CONSTRAINT "TaskScore_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
