import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createEnrollmentSchema, updateEnrollmentSchema } from "../schemas/enrollments.js";
import { sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { validateGuardianRelationAndAdultDoc } from "../utils/guardianValidation.js";

const router = Router();
const gradeLabels: Record<string, string> = {
  PRE_JARDIN: "Pre Jardin",
  JARDIN: "Jardin",
  TRANSICION: "Transicion",
  PRIMERO: "Primero",
  SEGUNDO: "Segundo",
  TERCERO: "Tercero",
  CUARTO: "Cuarto",
  QUINTO: "Quinto",
  SEXTO: "Sexto",
  SEPTIMO: "Septimo",
  OCTAVO: "Octavo",
  NOVENO: "Noveno",
  DECIMO: "Decimo",
  ONCE: "Once"
};

function normalizeDateOrNull(value?: string) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return new Date(normalized);
}

function classGradeLevelValue(classEntity: any) {
  return String(classEntity?.gradeLevel || "").trim();
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function linkParentToStudent(
  tx: Prisma.TransactionClient,
  params: { studentId: string; guardianRelation?: string | null; contactEmail?: string | null; guardianFullName?: string | null }
) {
  const email = normalizeEmail(params.contactEmail || "");
  if (!isEmailLike(email)) return;
  const user = await tx.user.findUnique({
    where: { email },
    select: { id: true, role: true }
  });
  if (!user || user.role !== "PARENT") return;

  const parent = await tx.parent.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
    select: { id: true }
  });

  const relation = String(params.guardianRelation || "").trim() || "Acudiente";
  await tx.guardian.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: params.studentId
      }
    },
    update: { relation },
    create: {
      parentId: parent.id,
      studentId: params.studentId,
      relation
    }
  });
}

router.post("/", requireAuth, requireRole(["ADMIN"]), validate(createEnrollmentSchema), async (req, res) => {
  const { body } = (req as any).validated;
  const requiredEnrollmentFields: Array<{ key: string; label: string }> = [
    { key: "admissionId", label: "Admision aprobada" },
    { key: "studentFullName", label: "Nombre del estudiante" },
    { key: "studentBirthDate", label: "Fecha de nacimiento" },
    { key: "studentDocType", label: "Tipo de documento del estudiante" },
    { key: "studentDocNumber", label: "Numero de documento del estudiante" },
    { key: "studentGradeLevel", label: "Nivel/Grado" },
    { key: "guardianFullName", label: "Nombre del acudiente" },
    { key: "guardianDocNumber", label: "Documento del acudiente" },
    { key: "guardianRelation", label: "Parentesco del acudiente" },
    { key: "contactPhone", label: "Telefono de contacto" }
  ];

  const missing = requiredEnrollmentFields
    .filter((f) => !String((body as any)[f.key] ?? "").trim())
    .map((f) => f.label);

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Completa los datos obligatorios para matricular: ${missing.join(", ")}`
    });
  }

  const guardianValidationError = validateGuardianRelationAndAdultDoc({
    guardianRelation: body.guardianRelation,
    guardianDocType: body.guardianDocType
  });
  if (guardianValidationError) {
    return res.status(400).json({ message: guardianValidationError });
  }

  try {
    const enrollment = await prisma.$transaction(async (tx) => {
      const classEntity = await tx.class.findUnique({
        where: { id: body.classId },
        select: { id: true, gradeLevel: true }
      });

      if (!classEntity) {
        throw new Error("Clase no encontrada");
      }

      if (classGradeLevelValue(classEntity) !== body.studentGradeLevel) {
        throw new Error("La clase seleccionada no corresponde al nivel/grado del estudiante");
      }

      let admission: any = null;
      if (body.admissionId) {
        admission = await tx.admission.findUnique({
          where: { id: body.admissionId },
          include: { enrollment: true }
        });

        if (!admission) {
          throw new Error("Admision no encontrada");
        }
        if (admission.status !== "APPROVED") {
          throw new Error("Solo se puede matricular desde admisiones aprobadas");
        }
        if (admission.enrollment) {
          throw new Error("Esta admision ya fue matriculada");
        }
        if (admission.enrollmentDueAt && new Date(admission.enrollmentDueAt) < new Date()) {
          throw new Error("El plazo de matricula para esta admision ya vencio");
        }
      }

      let studentId = body.studentId;
      if (studentId) {
        const existingStudent = await tx.student.findUnique({ where: { id: studentId } });
        if (!existingStudent) {
          // Si llega un ID invalido desde UI, continuar por flujo de alta/reuso por nombre.
          studentId = undefined;
        }
      } else {
        const normalizedDoc = String(body.studentDocNumber || "").trim();
        const fallbackName = body.studentFullName.trim();

        // Try to reuse an existing student by exact full name.
        const reusedStudent = await tx.student.findFirst({
          where: { fullName: { equals: fallbackName, mode: "insensitive" } },
          select: { id: true }
        });

        if (reusedStudent) {
          studentId = reusedStudent.id;
        } else {
          const createdStudent = await tx.student.create({
            data: {
              fullName: fallbackName,
              birthDate: body.studentBirthDate ? new Date(body.studentBirthDate) : undefined,
              gradeLevel: body.studentGradeLevel
            },
            select: { id: true }
          });
          studentId = createdStudent.id;
        }

        if (!studentId && !normalizedDoc) {
          throw new Error("No se pudo determinar el estudiante para matricular");
        }
      }

      if (!studentId) {
        const fallbackName = body.studentFullName.trim();
        const reusedStudent = await tx.student.findFirst({
          where: { fullName: { equals: fallbackName, mode: "insensitive" } },
          select: { id: true }
        });
        if (reusedStudent) {
          studentId = reusedStudent.id;
        } else {
          const createdStudent = await tx.student.create({
            data: {
              fullName: fallbackName,
              birthDate: body.studentBirthDate ? new Date(body.studentBirthDate) : undefined,
              gradeLevel: body.studentGradeLevel
            },
            select: { id: true }
          });
          studentId = createdStudent.id;
        }
      }

      const duplicated = await tx.enrollment.findFirst({
        where: { studentId, classId: body.classId, year: body.year },
        select: { id: true }
      });
      if (duplicated) {
        throw new Error("El estudiante ya tiene una matricula para esa clase y ano");
      }

      const alreadyEnrolled = await tx.enrollment.findFirst({
        where: {
          studentId,
          year: body.year
        },
        include: {
          class: { select: { id: true, gradeLevel: true } }
        }
      });
      if (alreadyEnrolled) {
        throw new Error(
          `El estudiante ya esta matriculado en ${classGradeLevelValue(alreadyEnrolled.class) || "otro grado"} para el ano ${body.year}`
        );
      }

      const created = await tx.enrollment.create({
        data: {
          studentId: studentId!,
          classId: body.classId,
          year: body.year,
          status: body.status,
          admissionId: body.admissionId,
          studentFullName: body.studentFullName,
          studentBirthDate: body.studentBirthDate ? new Date(body.studentBirthDate) : undefined,
          studentBirthPlaceDept: body.studentBirthPlaceDept,
          studentBirthPlaceCity: body.studentBirthPlaceCity,
          studentGender: body.studentGender,
          studentDocType: body.studentDocType,
          studentDocNumber: body.studentDocNumber,
          studentGradeLevel: body.studentGradeLevel,
          studentAddress: body.studentAddress,
          guardianFullName: body.guardianFullName?.trim() || "Sin registrar",
          guardianDocType: body.guardianDocType,
          guardianDocNumber: body.guardianDocNumber?.trim() || "N/A",
          guardianRelation: body.guardianRelation?.trim() || "ACUDIENTE_LEGAL",
          contactPhone: body.contactPhone?.trim() || "N/A",
          contactEmail: body.contactEmail,
          documents: body.documents,
          documentsNotes: body.documentsNotes
        }
      });

      await linkParentToStudent(tx, {
        studentId: created.studentId,
        guardianRelation: body.guardianRelation,
        contactEmail: body.contactEmail,
        guardianFullName: body.guardianFullName
      });

      if (admission) {
        await tx.admission.update({
          where: { id: admission.id },
          data: { status: "APPROVED" }
        });
      }

      return created;
    });

    res.json(enrollment);
  } catch (error: any) {
    res.status(400).json({ message: error?.message || "No fue posible registrar la matricula" });
  }
});

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 0);
  const pageSize = Number(req.query.pageSize || 10);
  const search = String(req.query.search || "").trim();
  const matchedGradeLevel = Object.keys(gradeLabels).find((grade) => {
    const normalizedSearch = search.toUpperCase().replace(/\s+/g, "_");
    const normalizedLabel = gradeLabels[grade].toUpperCase().replace(/\s+/g, "_");
    return grade === normalizedSearch || normalizedLabel === normalizedSearch;
  });

  const where = {
    ...(search
      ? {
          OR: [
            { studentFullName: { contains: search, mode: "insensitive" as const } },
            { guardianFullName: { contains: search, mode: "insensitive" as const } },
            ...(matchedGradeLevel
              ? [
                  {
                    class: {
                      OR: [
                        { gradeLevel: matchedGradeLevel as any }
                      ]
                    }
                  }
                ]
              : [])
          ]
        }
      : {})
  };

  const include = {
    student: true,
    class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
  };

  if (page > 0) {
    const [data, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include,
        orderBy: [{ year: "desc" }, { studentFullName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.enrollment.count({ where })
    ]);
    return res.json({ data, total, page, pageSize });
  }

  const data = await prisma.enrollment.findMany({
    where,
    include,
    orderBy: [{ year: "desc" }, { studentFullName: "asc" }]
  });
  return res.json(data);
});

router.patch("/:id", requireAuth, requireRole(["ADMIN"]), validate(updateEnrollmentSchema), async (req, res) => {
  const { params, body } = (req as any).validated;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: params.id },
        include: { class: { select: { id: true, gradeLevel: true } } }
      });
      if (!enrollment) throw new Error("Matricula no encontrada");

      const classId = body.classId || enrollment.classId;
      const studentGradeLevel = body.studentGradeLevel || enrollment.studentGradeLevel;
      const year = body.year ?? enrollment.year;

      const classEntity = await tx.class.findUnique({
        where: { id: classId },
        select: { id: true, gradeLevel: true }
      });
      if (!classEntity) throw new Error("Clase no encontrada");
      if (classGradeLevelValue(classEntity) !== studentGradeLevel) {
        throw new Error("La clase seleccionada no corresponde al nivel/grado del estudiante");
      }

      const duplicated = await tx.enrollment.findFirst({
        where: {
          id: { not: enrollment.id },
          studentId: enrollment.studentId,
          classId,
          year
        },
        select: { id: true }
      });
      if (duplicated) {
        throw new Error("El estudiante ya tiene una matricula para esa clase y ano");
      }

      if (body.guardianRelation !== undefined || body.guardianDocType !== undefined) {
        const guardianValidationError = validateGuardianRelationAndAdultDoc({
          guardianRelation: body.guardianRelation ?? enrollment.guardianRelation,
          guardianDocType: body.guardianDocType ?? enrollment.guardianDocType
        });
        if (guardianValidationError) {
          throw new Error(guardianValidationError);
        }
      }

      return tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          classId,
          year,
          status: body.status,
          studentFullName: body.studentFullName,
          studentBirthDate: normalizeDateOrNull(body.studentBirthDate),
          studentBirthPlaceDept: body.studentBirthPlaceDept,
          studentBirthPlaceCity: body.studentBirthPlaceCity,
          studentGender: body.studentGender,
          studentDocType: body.studentDocType,
          studentDocNumber: body.studentDocNumber,
          studentGradeLevel,
          studentAddress: body.studentAddress,
          guardianFullName: body.guardianFullName,
          guardianDocType: body.guardianDocType,
          guardianDocNumber: body.guardianDocNumber,
          guardianRelation: body.guardianRelation,
          contactPhone: body.contactPhone,
          contactEmail: body.contactEmail,
          documents: body.documents,
          documentsNotes: body.documentsNotes
        },
        include: {
          student: true,
          class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
        }
      });
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || "No fue posible actualizar la matricula" });
  }
});

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const enrollmentId = String(req.params.id || "");
  if (!enrollmentId) return res.status(400).json({ message: "Matricula invalida" });

  try {
    await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { id: true, admissionId: true }
      });
      if (!enrollment) throw new Error("Matricula no encontrada");

      await tx.attendance.deleteMany({ where: { enrollmentId } });
      await tx.grade.deleteMany({ where: { enrollmentId } });
      await tx.enrollment.delete({ where: { id: enrollmentId } });

      if (enrollment.admissionId) {
        await tx.admission.update({
          where: { id: enrollment.admissionId },
          data: { status: "APPROVED" }
        });
      }
    });
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || "No fue posible eliminar la matricula" });
  }
});

router.get("/export/pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const data = await prisma.enrollment.findMany({
    include: {
      class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
    },
    orderBy: [{ year: "desc" }, { studentFullName: "asc" }]
  });

  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "matriculas-estudiantes.pdf",
    title: "Reporte de Matriculas de Estudiantes",
    branding,
    columns: [
      { key: "studentFullName", label: "Estudiante", width: 120 },
      { key: "studentGradeLevel", label: "Grado", width: 58, align: "center" },
      { key: "gradeAssigned", label: "Grado", width: 86, align: "center" },
      { key: "teacher", label: "Docente", width: 90 },
      { key: "year", label: "Ano", width: 44, align: "center" },
      { key: "status", label: "Estado", width: 52, align: "center" },
      { key: "guardianFullName", label: "Acudiente", width: 100 }
    ],
    rows: data.map((item) => ({
      studentFullName: item.studentFullName,
      studentGradeLevel: gradeLabels[item.studentGradeLevel] || item.studentGradeLevel,
      gradeAssigned: classGradeLevelValue(item.class) || "-",
      teacher: item.class?.teacher?.user?.fullName || "-",
      year: item.year,
      status: item.status,
      guardianFullName: item.guardianFullName
    }))
  });
});

export default router;
