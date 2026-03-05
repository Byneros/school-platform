import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createStudentSchema, updateStudentSchema } from "../schemas/students.js";

const router = Router();
const preschoolGrades = new Set(["PRE_JARDIN", "JARDIN", "TRANSICION"]);

function normalizeGroup(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function isValidGroupForGrade(gradeLevel: string, studentGroup: string | null) {
  if (!studentGroup) return true;
  if (preschoolGrades.has(gradeLevel)) return ["A", "B", "C"].includes(studentGroup);
  return ["1", "2", "3"].includes(studentGroup);
}

router.get("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  const page = Number(_req.query.page || 1);
  const pageSize = Number(_req.query.pageSize || 10);
  const search = String(_req.query.search || "").trim();
  const gradeLevel = String(_req.query.gradeLevel || "").trim();

  const normalizeGrade = (s: string) =>
    s
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[ÁÀÂÄ]/g, "A")
      .replace(/[ÉÈÊË]/g, "E")
      .replace(/[ÍÌÎÏ]/g, "I")
      .replace(/[ÓÒÔÖ]/g, "O")
      .replace(/[ÚÙÛÜ]/g, "U")
      .replace(/Ñ/g, "N")
      .replace(/[°º]/g, "")
      .replace(/^GRADO_?/g, "");

  const gradeAliasMap: Record<string, string> = {
    "0": "TRANSICION",
    "1": "PRIMERO",
    "2": "SEGUNDO",
    "3": "TERCERO",
    "4": "CUARTO",
    "5": "QUINTO",
    "6": "SEXTO",
    "7": "SEPTIMO",
    "8": "OCTAVO",
    "9": "NOVENO",
    "10": "DECIMO",
    "11": "ONCE"
  };

  const rawGradeMatch = search ? normalizeGrade(search) : "";
  const gradeMatch = gradeAliasMap[rawGradeMatch] || rawGradeMatch;
  const isGrade = [
    "PRE_JARDIN",
    "JARDIN",
    "TRANSICION",
    "PRIMERO",
    "SEGUNDO",
    "TERCERO",
    "CUARTO",
    "QUINTO",
    "SEXTO",
    "SEPTIMO",
    "OCTAVO",
    "NOVENO",
    "DECIMO",
    "ONCE"
  ].includes(gradeMatch);

  const whereFromSearch: Prisma.StudentWhereInput = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          ...(isGrade ? [{ gradeLevel: gradeMatch as any }] : [])
        ]
      }
    : {};

  const finalWhere: Prisma.StudentWhereInput = {
    ...whereFromSearch,
    ...(gradeLevel ? { gradeLevel: gradeLevel as any } : {})
  };

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where: finalWhere,
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.student.count({ where: finalWhere })
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/simple", requireAuth, requireRole(["TEACHER", "ADMIN"]), async (_req, res) => {
  const students = await prisma.student.findMany({
    select: { id: true, fullName: true, gradeLevel: true },
    orderBy: { fullName: "asc" }
  });
  res.json(students);
});

router.get("/:id/profile", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const studentId = String(req.params.id || "").trim();
  if (!studentId) return res.status(400).json({ message: "Estudiante invalido" });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: { class: true },
        orderBy: [{ year: "desc" }, { id: "desc" }],
        take: 1
      }
    }
  });

  if (!student) return res.status(404).json({ message: "Estudiante no encontrado" });

  const latestEnrollment = student.enrollments[0];
  res.json({
    id: student.id,
    fullName: student.fullName,
    birthDate: student.birthDate,
    gradeLevel: student.gradeLevel,
    studentGroup: student.studentGroup,
    latestEnrollment: latestEnrollment
      ? {
          id: latestEnrollment.id,
          classId: latestEnrollment.classId,
          year: latestEnrollment.year,
          status: latestEnrollment.status,
          studentBirthPlaceDept: latestEnrollment.studentBirthPlaceDept,
          studentBirthPlaceCity: latestEnrollment.studentBirthPlaceCity,
          studentGender: latestEnrollment.studentGender,
          studentDocType: latestEnrollment.studentDocType,
          studentDocNumber: latestEnrollment.studentDocNumber,
          studentAddress: latestEnrollment.studentAddress,
          guardianFullName: latestEnrollment.guardianFullName,
          guardianDocType: latestEnrollment.guardianDocType,
          guardianDocNumber: latestEnrollment.guardianDocNumber,
          guardianRelation: latestEnrollment.guardianRelation,
          contactPhone: latestEnrollment.contactPhone,
          contactEmail: latestEnrollment.contactEmail
        }
      : null
  });
});

router.post("/", requireAuth, requireRole(["ADMIN"]), validate(createStudentSchema), async (req, res) => {
  const { body } = (req as any).validated;
  const normalizedGroup = normalizeGroup(body.studentGroup);
  if (!isValidGroupForGrade(body.gradeLevel, normalizedGroup)) {
    return res.status(400).json({
      message: preschoolGrades.has(body.gradeLevel)
        ? "Para preescolar el grupo debe ser A, B o C"
        : "Para primaria/secundaria el grupo debe ser 1, 2 o 3"
    });
  }
  const student = await prisma.student.create({
    data: {
      ...body,
      studentGroup: normalizedGroup
    }
  });
  res.json(student);
});

router.patch("/:id", requireAuth, requireRole(["ADMIN"]), validate(updateStudentSchema), async (req, res) => {
  const { params, body } = (req as any).validated;
  const current = await prisma.student.findUnique({
    where: { id: params.id },
    select: { gradeLevel: true, studentGroup: true }
  });
  if (!current) return res.status(404).json({ message: "Estudiante no encontrado" });

  const nextGradeLevel = body.gradeLevel || current.gradeLevel;
  const nextGroup = body.studentGroup !== undefined ? normalizeGroup(body.studentGroup) : current.studentGroup;
  if (!isValidGroupForGrade(nextGradeLevel, nextGroup)) {
    return res.status(400).json({
      message: preschoolGrades.has(nextGradeLevel)
        ? "Para preescolar el grupo debe ser A, B o C"
        : "Para primaria/secundaria el grupo debe ser 1, 2 o 3"
    });
  }

  const student = await prisma.student.update({
    where: { id: params.id },
    data: {
      ...body,
      ...(body.studentGroup !== undefined ? { studentGroup: normalizeGroup(body.studentGroup) } : {}),
      ...(body.birthDate ? { birthDate: new Date(body.birthDate) } : {})
    }
  });
  res.json(student);
});

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const studentId = String(req.params.id || "");
  if (!studentId) return res.status(400).json({ message: "Estudiante invalido" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ message: "Estudiante no encontrado" });

  await prisma.$transaction(async (tx) => {
    // Eliminar relaciones directas manteniendo integridad
    await tx.guardian.deleteMany({ where: { studentId } });
    await tx.notification.updateMany({ where: { studentId }, data: { studentId: null } });

    const enrollments = await tx.enrollment.findMany({ where: { studentId }, select: { id: true } });
    const enrollmentIds = enrollments.map((e) => e.id);
    if (enrollmentIds.length) {
      await tx.attendance.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await tx.grade.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
    }

    const invoices = await tx.invoice.findMany({ where: { studentId }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length) {
      await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    await tx.student.delete({ where: { id: studentId } });
  });

  res.json({ ok: true });
});

export default router;
