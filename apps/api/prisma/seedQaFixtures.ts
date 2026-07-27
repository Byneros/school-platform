import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dayOfWeekInSpanishUpper(date = new Date(), timeZone = "America/Bogota") {
  const raw = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone }).format(date);
  const normalized = normalizeDayOfWeek(raw);
  const map: Record<string, string> = {
    DOMINGO: "DOMINGO",
    LUNES: "LUNES",
    MARTES: "MARTES",
    MIERCOLES: "MIERCOLES",
    JUEVES: "JUEVES",
    VIERNES: "VIERNES",
    SABADO: "SABADO",
  };
  return map[normalized] || normalized;
}

function utcDateOnly(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDateNoon(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

async function main() {
  const year = Number(process.env.TEST_ACADEMIC_YEAR || new Date().getFullYear());
  const attendanceDate = utcDateOnly();
  const dayOfWeek = dayOfWeekInSpanishUpper(utcDateNoon());

  if (dayOfWeek === "DOMINGO") {
    throw new Error("El fixture QA de asistencia no debe generarse en domingo.");
  }

  const adminPassword = await bcrypt.hash(process.env.TEST_ADMIN_PASSWORD || "Admin123!", 10);
  const teacherPassword = await bcrypt.hash(process.env.TEST_TEACHER_PASSWORD || "Teacher123!", 10);
  const parentPassword = await bcrypt.hash(process.env.TEST_PARENT_PASSWORD || "Parent123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: process.env.TEST_ADMIN_EMAIL || "admin@colegio.edu" },
    update: {
      passwordHash: adminPassword,
      fullName: "Administrador Principal",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: process.env.TEST_ADMIN_EMAIL || "admin@colegio.edu",
      passwordHash: adminPassword,
      fullName: "Administrador Principal",
      role: "ADMIN",
      isActive: true,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: process.env.TEST_TEACHER_EMAIL || "docente@colegio.edu" },
    update: {
      passwordHash: teacherPassword,
      fullName: "Docente Demo",
      role: "TEACHER",
      isActive: true,
    },
    create: {
      email: process.env.TEST_TEACHER_EMAIL || "docente@colegio.edu",
      passwordHash: teacherPassword,
      fullName: "Docente Demo",
      role: "TEACHER",
      isActive: true,
    },
  });

  const parentUser = await prisma.user.upsert({
    where: { email: process.env.TEST_PARENT_EMAIL || "padre@colegio.edu" },
    update: {
      passwordHash: parentPassword,
      fullName: "Padre Demo",
      role: "PARENT",
      isActive: true,
    },
    create: {
      email: process.env.TEST_PARENT_EMAIL || "padre@colegio.edu",
      passwordHash: parentPassword,
      fullName: "Padre Demo",
      role: "PARENT",
      isActive: true,
    },
  });

  const subjectSchedules = {
    General: [{ dayOfWeek, gradeLevel: "PRIMERO", group: "QA" }],
  };

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {
      professionalProfile: "Docente QA para pruebas de asistencia.",
      subjects: ["General"],
      subjectHours: { General: 10 },
      subjectHoursMode: { General: false },
      subjectSchedules,
      cognitiveWeight: 60,
      personalWeight: 20,
      socialWeight: 20,
    },
    create: {
      userId: teacherUser.id,
      professionalProfile: "Docente QA para pruebas de asistencia.",
      subjects: ["General"],
      subjectHours: { General: 10 },
      subjectHoursMode: { General: false },
      subjectSchedules,
      cognitiveWeight: 60,
      personalWeight: 20,
      socialWeight: 20,
    },
  });

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });

  const student = await prisma.student.upsert({
    where: { id: "qa-student-attendance" },
    update: {
      fullName: "Estudiante QA Asistencia",
      gradeLevel: "PRIMERO",
      studentGroup: "QA",
      isActive: true,
    },
    create: {
      id: "qa-student-attendance",
      fullName: "Estudiante QA Asistencia",
      birthDate: new Date("2016-02-10T00:00:00.000Z"),
      gradeLevel: "PRIMERO",
      studentGroup: "QA",
      isActive: true,
    },
  });

  const classEntity = await prisma.class.upsert({
    where: { id: "qa-class-attendance" },
    update: {
      teacherId: teacher.id,
      gradeLevel: "PRIMERO",
      studentGroup: "QA",
      academicYear: year,
      schedule: subjectSchedules,
    },
    create: {
      id: "qa-class-attendance",
      teacherId: teacher.id,
      gradeLevel: "PRIMERO",
      studentGroup: "QA",
      academicYear: year,
      schedule: subjectSchedules,
    },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: {
      studentId_classId_year: {
        studentId: student.id,
        classId: classEntity.id,
        year,
      },
    },
    update: {
      status: "ACTIVE",
      studentFullName: student.fullName,
      studentGradeLevel: "PRIMERO",
      guardianFullName: "Padre Demo",
      guardianDocNumber: "QA-PARENT-DOC",
      guardianRelation: "Padre",
      contactPhone: "3001234567",
      contactEmail: parentUser.email,
    },
    create: {
      studentId: student.id,
      classId: classEntity.id,
      year,
      status: "ACTIVE",
      studentFullName: student.fullName,
      studentBirthDate: student.birthDate,
      studentBirthPlaceDept: "Cundinamarca",
      studentBirthPlaceCity: "Bogota",
      studentGender: "FEMENINO",
      studentDocType: "REGISTRO_CIVIL",
      studentDocNumber: "QA-STUDENT-DOC",
      studentGradeLevel: "PRIMERO",
      studentAddress: "Direccion QA",
      guardianFullName: "Padre Demo",
      guardianDocType: "CEDULA",
      guardianDocNumber: "QA-PARENT-DOC",
      guardianRelation: "Padre",
      contactPhone: "3001234567",
      contactEmail: parentUser.email,
      documents: {
        civilRegistry: true,
        guardianId: true,
        residenceProof: true,
      },
      documentsNotes: "Fixture QA",
    },
  });

  await prisma.guardian.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: student.id,
      },
    },
    update: { relation: "Padre" },
    create: {
      parentId: parent.id,
      studentId: student.id,
      relation: "Padre",
    },
  });

  await prisma.attendance.upsert({
    where: {
      enrollmentId_date: {
        enrollmentId: enrollment.id,
        date: attendanceDate,
      },
    },
    update: {
      status: "PRESENT",
      notes: `[[teacherId:${teacher.id}]]\nFixture QA`,
    },
    create: {
      enrollmentId: enrollment.id,
      date: attendanceDate,
      status: "PRESENT",
      notes: `[[teacherId:${teacher.id}]]\nFixture QA`,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        title: "Fixture QA activo",
        body: "Datos QA generados para regression tests.",
        status: "APPROVED",
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    `QA fixtures OK: teacher=${teacherUser.email}, student=${student.fullName}, date=${attendanceDate
      .toISOString()
      .slice(0, 10)}, day=${dayOfWeek}`
  );
}

main()
  .catch((error) => {
    console.error("QA fixtures FAIL:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
