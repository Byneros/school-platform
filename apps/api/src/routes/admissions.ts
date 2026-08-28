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
import { getSchoolId, schoolScope, withSchool } from "../utils/schoolDb.js";

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

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const search = String(req.query.search || "").trim();
  const now = new Date();

  const where: Prisma.AdmissionWhereInput = {
    ...schoolScope(req),
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
      ...schoolScope(_req),
      status: "APPROVED",
      enrollment: null,
      OR: [{ enrollmentDueAt: null }, { enrollmentDueAt: { gte: now } }],
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          gradeLevel: true,
          studentGroup: true,
          documentNumber: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(data);
});

router.get("/export/csv", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const data = await prisma.admission.findMany({
    where: schoolScope(_req),
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
    where: schoolScope(_req),
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
    where: schoolScope(_req),
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
        schoolId: getSchoolId(req),
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

    const current = await prisma.admission.findFirst({
      where: { id: params.id, ...schoolScope(req) },
      select: { id: true },
    });
    if (!current) return res.status(404).json({ message: "Admision no encontrada" });

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

        const currentAdmission = await tx.admission.findFirst({
          where: { id: params.id, ...schoolScope(req) },
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

        // Si no se está aprobando, o ya existe matrícula,
        // no se crea/vincula ningún estudiante.
        if (!isApproved || admission.enrollment) {
          return admission;
        }

        const fullName = (admission.studentFullName || admission.studentName || "").trim();

        if (!fullName) {
          throw new Error("La admision no contiene el nombre del estudiante.");
        }

        const schoolId = getSchoolId(req);

        let existingStudent: { id: string } | null = null;

        // 1. Buscar por número de documento dentro del colegio.
        const documentNumber = admission.studentDocNumber?.trim();

        if (documentNumber) {
          existingStudent = await tx.student.findFirst({
            where: {
              schoolId,
              documentNumber,
            },
            select: {
              id: true,
            },
          });
        }

        // 2. Si no existe por documento, buscar por nombre + grado
        //    dentro del mismo colegio.
        if (!existingStudent) {
          existingStudent = await tx.student.findFirst({
            where: {
              schoolId,
              fullName: {
                equals: fullName,
                mode: "insensitive",
              },
              gradeLevel: admission.gradeLevel,
            },
            select: {
              id: true,
            },
          });
        }

        // 3. Si no existe, crear el Student asociado al colegio.
        const studentId = existingStudent
          ? existingStudent.id
          : (
              await tx.student.create({
                data: withSchool(req, {
                  fullName,
                  birthDate: admission.studentBirthDate ?? undefined,
                  gradeLevel: admission.gradeLevel,
                  documentType: admission.studentDocType || undefined,
                  documentNumber: documentNumber || undefined,
                  gender: admission.studentGender || undefined,
                  address: admission.studentAddress || undefined,
                }),
                select: {
                  id: true,
                },
              })
            ).id;

        // 4. Vincular definitivamente la admisión con el Student.
        await tx.admission.update({
          where: {
            id: admission.id,
          },
          data: {
            studentId,
          },
        });

        // 5. Devolver la admisión con su Student relacionado.
        return tx.admission.findUnique({
          where: {
            id: admission.id,
          },
          include: {
            enrollment: true,
            student: true,
          },
        });
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({
        message: error?.message || "No fue posible actualizar el estado de admision",
      });
    }
  }
);

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Admision invalida" });

  const admission = await prisma.admission.findFirst({
    where: { id, ...schoolScope(req) },
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
