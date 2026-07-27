import { Router } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import {
  createAdmissionSchema,
  updateAdmissionSchema,
  updateAdmissionStatusSchema,
} from "../schemas/admissions.js";
import { buildCsvReport, buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { validateGuardianRelationAndAdultDoc } from "../utils/guardianValidation.js";

const router = Router();

function addBusinessDays(start: Date, days: number) {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function linkParentToStudent(
  tx: Prisma.TransactionClient,
  params: {
    studentId: string;
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
    update: {},
    create: { userId: user.id },
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

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const search = String(req.query.search || "").trim();
  const now = new Date();

  const where: Prisma.AdmissionWhereInput = {
    enrollment: null,
    ...(status
      ? { status: status as any }
      : {
          status: { not: "APPROVED" },
        }),
    ...(status === "APPROVED"
      ? {
          OR: [{ enrollmentDueAt: null }, { enrollmentDueAt: { gte: now } }],
        }
      : {}),
    ...(gradeLevel ? { gradeLevel: gradeLevel as any } : {}),
    ...(search ? { studentName: { contains: search, mode: "insensitive" } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.admission.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.admission.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/approved", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const now = new Date();
  const data = await prisma.admission.findMany({
    where: {
      status: "APPROVED",
      enrollment: null,
      OR: [{ enrollmentDueAt: null }, { enrollmentDueAt: { gte: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(data);
});

router.get("/export/csv", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const data = await prisma.admission.findMany({
    select: {
      studentName: true,
      gradeLevel: true,
      status: true,
      createdAt: true,
      enrollmentDueAt: true,
    },
  });
  const branding = await getBrandingSettings();
  const csv = buildCsvReport({
    title: "Reporte de Admisiones",
    institutionName: branding.schoolName,
    columns: [
      { key: "studentName", label: "Estudiante" },
      { key: "gradeLevel", label: "Nivel" },
      { key: "status", label: "Estado" },
      { key: "createdAt", label: "Fecha solicitud" },
      { key: "enrollmentDueAt", label: "Fecha limite matricula" },
    ],
    rows: data.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString().slice(0, 10),
      enrollmentDueAt: a.enrollmentDueAt ? a.enrollmentDueAt.toISOString().slice(0, 10) : "-",
    })),
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="admissions.csv"');
  res.send(csv);
});

router.get("/export/excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const data = await prisma.admission.findMany({
    select: {
      studentName: true,
      gradeLevel: true,
      status: true,
      createdAt: true,
      enrollmentDueAt: true,
    },
  });
  const branding = await getBrandingSettings();
  const xlsx = await buildXlsxReportBuffer({
    title: "Reporte de Admisiones",
    institutionName: branding.schoolName,
    columns: [
      { key: "studentName", label: "Estudiante" },
      { key: "gradeLevel", label: "Nivel" },
      { key: "status", label: "Estado" },
      { key: "createdAt", label: "Fecha solicitud" },
      { key: "enrollmentDueAt", label: "Fecha limite matricula" },
    ],
    rows: data.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString().slice(0, 10),
      enrollmentDueAt: a.enrollmentDueAt ? a.enrollmentDueAt.toISOString().slice(0, 10) : "-",
    })),
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="admissions-report.xlsx"');
  res.send(xlsx);
});

router.get("/export/pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const data = await prisma.admission.findMany({
    select: {
      studentName: true,
      gradeLevel: true,
      status: true,
      createdAt: true,
      enrollmentDueAt: true,
    },
  });
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "admissions.pdf",
    title: "Reporte de Admisiones",
    branding,
    columns: [
      { key: "studentName", label: "Estudiante", width: 170 },
      { key: "gradeLevel", label: "Nivel", width: 90, align: "center" },
      { key: "status", label: "Estado", width: 90, align: "center" },
      { key: "createdAt", label: "Solicitud", width: 90, align: "center" },
      { key: "enrollmentDueAt", label: "Vence", width: 90, align: "center" },
    ],
    rows: data.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString().slice(0, 10),
      enrollmentDueAt: a.enrollmentDueAt ? a.enrollmentDueAt.toISOString().slice(0, 10) : "-",
    })),
  });
});

router.post(
  "/",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(createAdmissionSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    if (body.guardianRelation !== undefined || body.guardianDocType !== undefined) {
      const guardianValidationError = validateGuardianRelationAndAdultDoc({
        guardianRelation: body.guardianRelation,
        guardianDocType: body.guardianDocType,
      });
      if (guardianValidationError) {
        return res.status(400).json({ message: guardianValidationError });
      }
    }

    const admission = await prisma.admission.create({
      data: {
        studentName: body.studentName,
        gradeLevel: body.gradeLevel,
        notes: body.notes,
        documents: body.documents,
        studentFullName: body.studentFullName,
        studentBirthDate: body.studentBirthDate ? new Date(body.studentBirthDate) : undefined,
        studentBirthPlaceDept: body.studentBirthPlaceDept,
        studentBirthPlaceCity: body.studentBirthPlaceCity,
        studentGender: body.studentGender,
        studentDocType: body.studentDocType,
        studentDocNumber: body.studentDocNumber,
        studentAddress: body.studentAddress,
        guardianFullName: body.guardianFullName,
        guardianDocType: body.guardianDocType,
        guardianDocNumber: body.guardianDocNumber,
        guardianRelation: body.guardianRelation,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
      },
    });
    res.json(admission);
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(updateAdmissionSchema),
  async (req, res) => {
    const { params, body } = (req as any).validated;
    if (body.guardianRelation !== undefined || body.guardianDocType !== undefined) {
      const guardianValidationError = validateGuardianRelationAndAdultDoc({
        guardianRelation: body.guardianRelation,
        guardianDocType: body.guardianDocType,
      });
      if (guardianValidationError) {
        return res.status(400).json({ message: guardianValidationError });
      }
    }

    const admission = await prisma.admission.update({
      where: { id: params.id },
      data: body,
    });
    res.json(admission);
  }
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(updateAdmissionStatusSchema),
  async (req, res) => {
    const { params, body } = (req as any).validated;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const isApproved = body.status === "APPROVED";

        const currentAdmission = await tx.admission.findUnique({
          where: { id: params.id },
          include: { enrollment: true },
        });

        if (!currentAdmission) {
          throw new Error("Admision no encontrada");
        }

        const admission = await tx.admission.update({
          where: { id: params.id },
          data: {
            status: body.status,
            approvedAt: isApproved ? now : null,
            enrollmentDueAt: isApproved ? addBusinessDays(now, 5) : null,
          },
          include: { enrollment: true },
        });

        if (!isApproved || admission.enrollment) {
          return admission;
        }

        const fullName = (admission.studentFullName || admission.studentName).trim();

        const existingStudent = await tx.student.findFirst({
          where: { fullName: { equals: fullName, mode: "insensitive" } },
          select: { id: true },
        });

        const studentId = existingStudent
          ? existingStudent.id
          : (
              await tx.student.create({
                data: {
                  fullName,
                  birthDate: admission.studentBirthDate ?? undefined,
                  gradeLevel: admission.gradeLevel,
                },
                select: { id: true },
              })
            ).id;

        const classForGrade = await tx.class.findFirst({
          where: { gradeLevel: admission.gradeLevel },
          orderBy: { id: "asc" },
          select: { id: true },
        });

        if (!classForGrade) {
          throw new Error(`No hay clases configuradas para el grado ${admission.gradeLevel}`);
        }

        const year = new Date().getFullYear();
        const duplicated = await tx.enrollment.findFirst({
          where: { studentId, classId: classForGrade.id, year },
          select: { id: true },
        });

        if (!duplicated) {
          const guardianValidationError = validateGuardianRelationAndAdultDoc({
            guardianRelation: admission.guardianRelation,
            guardianDocType: admission.guardianDocType,
          });
          if (!guardianValidationError) {
            await tx.enrollment.create({
              data: {
                studentId,
                classId: classForGrade.id,
                year,
                status: "ACTIVE",
                admissionId: admission.id,
                studentFullName: fullName,
                studentBirthDate: admission.studentBirthDate ?? undefined,
                studentBirthPlaceDept: admission.studentBirthPlaceDept,
                studentBirthPlaceCity: admission.studentBirthPlaceCity,
                studentGender: admission.studentGender,
                studentDocType: admission.studentDocType,
                studentDocNumber: admission.studentDocNumber,
                studentGradeLevel: admission.gradeLevel,
                studentAddress: admission.studentAddress,
                guardianFullName: admission.guardianFullName || "Sin registrar",
                guardianDocType: admission.guardianDocType,
                guardianDocNumber: admission.guardianDocNumber || "N/A",
                guardianRelation: admission.guardianRelation || "ACUDIENTE_LEGAL",
                contactPhone: admission.contactPhone || "N/A",
                contactEmail: admission.contactEmail,
              },
            });

            await linkParentToStudent(tx, {
              studentId,
              guardianRelation: admission.guardianRelation,
              contactEmail: admission.contactEmail,
              guardianFullName: admission.guardianFullName,
            });
          }
        }

        return tx.admission.findUnique({
          where: { id: admission.id },
          include: { enrollment: true },
        });
      });

      res.json(result);
    } catch (error: any) {
      res
        .status(400)
        .json({ message: error?.message || "No fue posible actualizar el estado de admision" });
    }
  }
);

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Admision invalida" });

  const admission = await prisma.admission.findUnique({
    where: { id },
    include: { enrollment: true },
  });
  if (!admission) return res.status(404).json({ message: "Admision no encontrada" });
  if (admission.enrollment) {
    return res.status(400).json({ message: "No se puede eliminar una admision con matricula" });
  }

  await prisma.admission.delete({ where: { id } });
  return res.json({ ok: true });
});

export default router;
