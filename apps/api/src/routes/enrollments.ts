import { Router } from "express";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createEnrollmentSchema, updateEnrollmentSchema } from "../schemas/enrollments.js";
import { sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { validateGuardianRelationAndAdultDoc } from "../utils/guardianValidation.js";
import {
  admissionScope,
  classScope,
  enrollmentScope,
  getSchoolId,
  studentScope,
  withSchool,
} from "../utils/schoolDb.js";

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
  ONCE: "Once",
};

function classGradeLevelValue(classEntity: any) {
  return String(classEntity?.gradeLevel || "").trim();
}

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function findOrCreateUnassignedTeacher(tx: Prisma.TransactionClient, schoolId: string) {
  const email = `docente.sin.asignar+${schoolId}@colegio.edu`;
  let user = await tx.user.findFirst({
    where: { email, schoolId },
    include: { teacher: true },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash("Unassigned123!", 10);
    user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: "Docente sin asignar",
        role: "TEACHER",
        isActive: false,
        schoolId,
      },
      include: { teacher: true },
    });
  }

  if (user.teacher?.id) return user.teacher.id;

  const teacher = await tx.teacher.create({
    data: { userId: user.id, schoolId },
    select: { id: true },
  });
  return teacher.id;
}

async function findOrCreateEnrollmentClass(
  tx: Prisma.TransactionClient,
  params: {
    schoolId: string;
    classId?: string | null;
    gradeLevel: string;
    academicYear: number;
    studentGroup?: string | null;
  }
) {
  const select = { id: true, gradeLevel: true, studentGroup: true, academicYear: true };
  let classEntity = await tx.class.findFirst({
    where: params.classId
      ? {
          id: params.classId,
          schoolId: params.schoolId,
          gradeLevel: params.gradeLevel as any,
          academicYear: params.academicYear,
        }
      : {
          schoolId: params.schoolId,
          gradeLevel: params.gradeLevel as any,
          academicYear: params.academicYear,
        },
    select,
    orderBy: { studentGroup: "asc" },
  });

  if (!classEntity && params.classId) {
    classEntity = await tx.class.findFirst({
      where: {
        schoolId: params.schoolId,
        gradeLevel: params.gradeLevel as any,
        academicYear: params.academicYear,
      },
      select,
      orderBy: { studentGroup: "asc" },
    });
  }

  if (classEntity) {
    return { classEntity, created: false };
  }

  const teacherId = await findOrCreateUnassignedTeacher(tx, params.schoolId);
  const studentGroup = String(params.studentGroup || "").trim() || "1";
  const created = await tx.class.create({
    data: {
      schoolId: params.schoolId,
      teacherId,
      gradeLevel: params.gradeLevel as any,
      studentGroup,
      academicYear: params.academicYear,
      schedule: {},
    },
    select,
  });

  return { classEntity: created, created: true };
}

function enrollmentView<T extends Record<string, any>>(enrollment: T) {
  const student = enrollment.student || {};
  const classEntity = enrollment.class || {};
  return {
    ...enrollment,
    studentFullName: enrollment.studentFullName || student.fullName || "",
    studentBirthDate: enrollment.studentBirthDate || student.birthDate || null,
    studentDocType: enrollment.studentDocType || student.documentType || "",
    studentDocNumber: enrollment.studentDocNumber || student.documentNumber || "",
    studentGradeLevel:
      enrollment.studentGradeLevel || classGradeLevelValue(classEntity) || student.gradeLevel,
    studentGroup: enrollment.studentGroup || classEntity.studentGroup || student.studentGroup || "",
  };
}

const enrollmentInclude = {
  school: true,
  admission: true,
  student: true,
  class: {
    include: {
      school: true,
      teacher: { include: { user: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.EnrollmentInclude;

async function syncStudentFromEnrollmentClass(
  tx: Prisma.TransactionClient,
  params: { studentId: string; classEntity: { gradeLevel: any; studentGroup?: string | null } }
) {
  await tx.student.update({
    where: { id: params.studentId },
    data: {
      gradeLevel: params.classEntity.gradeLevel,
      studentGroup: params.classEntity.studentGroup || null,
      isActive: true,
    },
  });
}

async function linkParentToStudent(
  tx: Prisma.TransactionClient,
  params: {
    studentId: string;
    schoolId: string;
    guardianRelation?: string | null;
    contactEmail?: string | null;
    guardianFullName?: string | null;
  }
) {
  const email = normalizeEmail(params.contactEmail || "");
  if (!isEmailLike(email)) return;
  const user = await tx.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "PARENT") return;

  const parent = await tx.parent.upsert({
    where: { userId: user.id },
    update: { schoolId: params.schoolId },
    create: { userId: user.id, schoolId: params.schoolId },
    select: { id: true },
  });

  const relation = String(params.guardianRelation || "").trim() || "Acudiente";
  await tx.guardian.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: params.studentId,
      },
    },
    update: { relation },
    create: {
      parentId: parent.id,
      studentId: params.studentId,
      relation,
    },
  });
}

router.post(
  "/",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(createEnrollmentSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const requiredEnrollmentFields: Array<{ key: string; label: string }> = [
      { key: "studentGradeLevel", label: "Nivel/Grado" },
      { key: "guardianFullName", label: "Nombre del acudiente" },
      { key: "guardianDocNumber", label: "Documento del acudiente" },
      { key: "guardianRelation", label: "Parentesco del acudiente" },
      { key: "contactPhone", label: "Telefono de contacto" },
    ];

    const missing = requiredEnrollmentFields
      .filter((f) => !String((body as any)[f.key] ?? "").trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Completa los datos obligatorios para matricular: ${missing.join(", ")}`,
      });
    }

    const guardianValidationError = validateGuardianRelationAndAdultDoc({
      guardianRelation: body.guardianRelation,
      guardianDocType: body.guardianDocType,
    });
    if (guardianValidationError) {
      return res.status(400).json({ message: guardianValidationError });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        let admission: any = null;
        if (body.admissionId) {
          admission = await tx.admission.findFirst({
            where: { id: body.admissionId, ...admissionScope(req) },
            include: { enrollment: true, student: true },
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
          if (!admission.studentId) {
            throw new Error(
              "La admision aprobada no tiene un estudiante asociado. Aprueba de nuevo la admision o corrige el registro antes de matricular."
            );
          }
        }

        const schoolId = getSchoolId(req);
        const requestedStudentId = admission?.studentId || body.studentId;
        if (!requestedStudentId) {
          throw new Error(
            "Selecciona un estudiante existente antes de crear la matricula. La matricula no crea estudiantes."
          );
        }

        const student = await tx.student.findFirst({
          where: { id: requestedStudentId, ...studentScope(req) },
          select: { id: true, fullName: true, gradeLevel: true, studentGroup: true },
        });
        if (!student) {
          throw new Error(
            "Selecciona un estudiante existente antes de crear la matricula. La matricula no crea estudiantes."
          );
        }
        const studentId = student.id;
        const academicYear = Number(body.year);
        const gradeLevel = String(body.studentGradeLevel || student.gradeLevel || "").trim();

        const { classEntity, created: classAutoCreated } = await findOrCreateEnrollmentClass(tx, {
          schoolId,
          classId: body.classId,
          gradeLevel,
          academicYear,
          studentGroup: body.studentGroup || student.studentGroup,
        });

        if (classGradeLevelValue(classEntity) !== body.studentGradeLevel) {
          throw new Error("La clase seleccionada no corresponde al nivel/grado del estudiante");
        }

        const duplicated = await tx.enrollment.findFirst({
          where: { ...enrollmentScope(req), studentId, classId: classEntity.id, year: body.year },
          select: { id: true },
        });
        if (duplicated) {
          throw new Error("El estudiante ya tiene una matricula para esa clase y ano");
        }

        const alreadyEnrolled = await tx.enrollment.findFirst({
          where: {
            ...enrollmentScope(req),
            studentId,
            year: body.year,
          },
          include: {
            class: { select: { id: true, gradeLevel: true } },
          },
        });
        if (alreadyEnrolled) {
          throw new Error(
            `El estudiante ya esta matriculado en ${classGradeLevelValue(alreadyEnrolled.class) || "otro grado"} para el ano ${body.year}`
          );
        }

        const created = await tx.enrollment.create({
          data: withSchool(req, {
            studentId: studentId!,
            classId: classEntity.id,
            year: body.year,
            status: body.status,
            admissionId: body.admissionId,
            campus: body.campus,
            shift: body.shift,
            enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : undefined,
            studentGradeLevel: body.studentGradeLevel,
            studentGroup: body.studentGroup || student.studentGroup,
            guardianFullName: body.guardianFullName?.trim() || "Sin registrar",
            guardianDocType: body.guardianDocType,
            guardianDocNumber: body.guardianDocNumber?.trim() || "N/A",
            guardianRelation: body.guardianRelation?.trim() || "ACUDIENTE_LEGAL",
            contactPhone: body.contactPhone?.trim() || "N/A",
            contactEmail: body.contactEmail,
            documents: body.documents,
            documentsNotes: body.documentsNotes,
          }),
          include: enrollmentInclude,
        });

        await syncStudentFromEnrollmentClass(tx, { studentId: created.studentId, classEntity });

        await linkParentToStudent(tx, {
          studentId: created.studentId,
          schoolId: getSchoolId(req),
          guardianRelation: body.guardianRelation,
          contactEmail: body.contactEmail,
          guardianFullName: body.guardianFullName,
        });

        if (admission) {
          await tx.admission.update({
            where: { id: admission.id },
            data: { status: "APPROVED" },
          });
        }

        return { enrollment: created, classAutoCreated };
      });

      const response = enrollmentView(result.enrollment);
      if (result.classAutoCreated) {
        res.json({
          ...response,
          classAutoCreated: true,
          classAdminPath: "/admin/horas-docentes",
          message: `La seccion ${response.studentGradeLevel}-${response.studentGroup || "1"}-${response.year} no existia y fue creada automaticamente. Revisa su docente y horario en Horas docentes.`,
        });
        return;
      }

      res.json(response);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "No fue posible registrar la matricula" });
    }
  }
);

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 0);
  const pageSize = Number(req.query.pageSize || 10);
  const search = String(req.query.search || "").trim();
  const year = Number(req.query.year || 0);
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const matchedGradeLevel = Object.keys(gradeLabels).find((grade) => {
    const normalizedSearch = search.toUpperCase().replace(/\s+/g, "_");
    const normalizedLabel = gradeLabels[grade].toUpperCase().replace(/\s+/g, "_");
    return grade === normalizedSearch || normalizedLabel === normalizedSearch;
  });

  const classFilters: Prisma.ClassWhereInput = {
    ...(gradeLevel ? { gradeLevel: gradeLevel as any } : {}),
    ...(group ? { studentGroup: { equals: group, mode: "insensitive" } } : {}),
  };
  const where: Prisma.EnrollmentWhereInput = {
    ...enrollmentScope(req),
    ...(year ? { year } : {}),
    ...(status ? { status } : {}),
    ...(Object.keys(classFilters).length ? { class: classFilters } : {}),
    ...(search
      ? {
          OR: [
            { student: { fullName: { contains: search, mode: "insensitive" as const } } },
            { student: { documentNumber: { contains: search, mode: "insensitive" as const } } },
            { guardianFullName: { contains: search, mode: "insensitive" as const } },
            ...(matchedGradeLevel
              ? [
                  {
                    class: {
                      OR: [{ gradeLevel: matchedGradeLevel as any }],
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  };

  if (page > 0) {
    const [data, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: enrollmentInclude,
        orderBy: [{ year: "desc" }, { student: { fullName: "asc" } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.enrollment.count({ where }),
    ]);
    return res.json({ data: data.map(enrollmentView), total, page, pageSize });
  }

  const data = await prisma.enrollment.findMany({
    where,
    include: enrollmentInclude,
    orderBy: [{ year: "desc" }, { student: { fullName: "asc" } }],
  });
  return res.json(data.map(enrollmentView));
});

router.get("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Matricula invalida" });

  const enrollment = await prisma.enrollment.findFirst({
    where: { id, ...enrollmentScope(req) },
    include: enrollmentInclude,
  });

  if (!enrollment) return res.status(404).json({ message: "Matricula no encontrada" });
  return res.json(enrollmentView(enrollment));
});

router.patch(
  "/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(updateEnrollmentSchema),
  async (req, res) => {
    const { params, body } = (req as any).validated;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: params.id, ...enrollmentScope(req) },
          include: { class: { select: { id: true, gradeLevel: true, studentGroup: true } } },
        });
        if (!enrollment) throw new Error("Matricula no encontrada");

        const classId = body.classId || enrollment.classId;
        const year = body.year ?? enrollment.year;

        const classEntity = await tx.class.findFirst({
          where: { id: classId, ...classScope(req) },
          select: { id: true, gradeLevel: true, studentGroup: true },
        });
        if (!classEntity) throw new Error("Clase no encontrada");
        const studentGradeLevel = body.studentGradeLevel || classEntity.gradeLevel;
        if (classGradeLevelValue(classEntity) !== studentGradeLevel) {
          throw new Error("La clase seleccionada no corresponde al nivel/grado del estudiante");
        }

        const duplicated = await tx.enrollment.findFirst({
          where: {
            ...enrollmentScope(req),
            id: { not: enrollment.id },
            studentId: enrollment.studentId,
            classId,
            year,
          },
          select: { id: true },
        });
        if (duplicated) {
          throw new Error("El estudiante ya tiene una matricula para esa clase y ano");
        }

        if (body.guardianRelation !== undefined || body.guardianDocType !== undefined) {
          const guardianValidationError = validateGuardianRelationAndAdultDoc({
            guardianRelation: body.guardianRelation ?? enrollment.guardianRelation,
            guardianDocType: body.guardianDocType ?? enrollment.guardianDocType,
          });
          if (guardianValidationError) {
            throw new Error(guardianValidationError);
          }
        }

        const updated = await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            // Matrícula
            classId,
            year,
            status: body.status,
            campus: body.campus,
            shift: body.shift,
            enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : undefined,

            // Datos del estudiante
            studentFullName: body.studentFullName,
            studentBirthDate: body.studentBirthDate ? new Date(body.studentBirthDate) : undefined,
            studentBirthPlaceDept: body.studentBirthPlaceDept,
            studentBirthPlaceCity: body.studentBirthPlaceCity,
            studentGender: body.studentGender,
            studentDocType: body.studentDocType,
            studentDocNumber: body.studentDocNumber,
            studentGradeLevel,
            studentGroup: body.studentGroup || classEntity.studentGroup,
            studentAddress: body.studentAddress,

            // Acudiente
            guardianFullName: body.guardianFullName,
            guardianDocType: body.guardianDocType,
            guardianDocNumber: body.guardianDocNumber,
            guardianRelation: body.guardianRelation,

            // Contacto
            contactPhone: body.contactPhone,
            contactEmail: body.contactEmail,

            // Documentos
            documents: body.documents,
            documentsNotes: body.documentsNotes,
          },
          include: {
            ...enrollmentInclude,
          },
        });

        await syncStudentFromEnrollmentClass(tx, {
          studentId: updated.studentId,
          classEntity,
        });

        return updated;
      });

      return res.json(enrollmentView(updated));
    } catch (error: any) {
      return res
        .status(400)
        .json({ message: error?.message || "No fue posible actualizar la matricula" });
    }
  }
);

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const enrollmentId = String(req.params.id || "");
  if (!enrollmentId) return res.status(400).json({ message: "Matricula invalida" });

  try {
    await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { id: true, admissionId: true },
      });
      const scopedEnrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, ...enrollmentScope(req) },
        select: { id: true, admissionId: true },
      });
      if (!enrollment || !scopedEnrollment) throw new Error("Matricula no encontrada");

      await tx.academicClosureResult.deleteMany({ where: { enrollmentId } });
      await tx.taskScore.deleteMany({ where: { enrollmentId } });
      await tx.attendance.deleteMany({ where: { enrollmentId } });
      await tx.grade.deleteMany({ where: { enrollmentId } });
      await tx.enrollment.delete({ where: { id: enrollmentId } });

      if (enrollment.admissionId) {
        await tx.admission.update({
          where: { id: enrollment.admissionId },
          data: { status: "APPROVED" },
        });
      }
    });
    return res.json({ ok: true });
  } catch (error: any) {
    return res
      .status(400)
      .json({ message: error?.message || "No fue posible eliminar la matricula" });
  }
});

router.get("/export/pdf", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const data = await prisma.enrollment.findMany({
    where: enrollmentScope(req),
    include: {
      student: true,
      school: true,
      admission: true,
      class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } },
    },
    orderBy: [{ year: "desc" }, { student: { fullName: "asc" } }],
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
      { key: "guardianFullName", label: "Acudiente", width: 100 },
    ],
    rows: data.map((raw) => {
      const item = enrollmentView(raw);
      return {
        studentFullName: item.studentFullName,
        studentGradeLevel: gradeLabels[item.studentGradeLevel] || item.studentGradeLevel,
        gradeAssigned: classGradeLevelValue(item.class) || "-",
        teacher: item.class?.teacher?.user?.fullName || "-",
        year: item.year,
        status: item.status,
        guardianFullName: item.guardianFullName,
      };
    }),
  });
});

export default router;
