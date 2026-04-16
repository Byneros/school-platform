import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { enqueueNotification } from "../services/notificationQueue.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createStudentObservationSchema, updateStudentObservationSchema } from "../schemas/studentObservations.js";
import { composeNotificationBodyWithMeta, type NotificationLegalReference } from "../utils/notificationMeta.js";
import { isDeveloperRole } from "../utils/rbac.js";

const router = Router();

type CoexistenceProtocolType = "TIPO_I" | "TIPO_II" | "TIPO_III";
type TeacherGradeGroup = { gradeLevel: string; group: string };

function normalizeDateStart(value?: string) {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function normalizeDateEnd(value?: string) {
  if (!value) return undefined;
  const d = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function normalizeGradeGroup(gradeLevelRaw: unknown, groupRaw: unknown) {
  const gradeRaw = String(gradeLevelRaw || "").trim().toUpperCase();
  const groupValue = String(groupRaw || "").trim();
  if (gradeRaw.includes("-") && !groupValue) {
    const [grade, ...rest] = gradeRaw.split("-").map((p) => p.trim()).filter(Boolean);
    return {
      gradeLevel: grade || "",
      group: rest.join("-") || ""
    };
  }
  return {
    gradeLevel: gradeRaw,
    group: groupValue
  };
}

function normalizeGradeKey(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeGroupKey(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function extractTeacherGradeGroups(rawSchedules: unknown): TeacherGradeGroup[] {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object" ? (rawSchedules as Record<string, unknown>) : {};
  const pairs: TeacherGradeGroup[] = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const normalized = normalizeGradeGroup(slot?.gradeLevel, slot?.group);
        pairs.push({
          gradeLevel: normalized.gradeLevel,
          group: normalized.group
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const normalized = normalizeGradeGroup((entry as any)?.gradeLevel, (entry as any)?.group);
      pairs.push({
        gradeLevel: normalized.gradeLevel,
        group: normalized.group
      });
    }
  });

  return pairs.filter((p) => p.gradeLevel);
}

const coexistenceTemplates: Record<
  CoexistenceProtocolType,
  {
    label: string;
    procedure: string[];
    commitments: string[];
    followups: string[];
    citations: string[];
  }
> = {
  TIPO_I: {
    label: "Tipo I (conflictos leves)",
    procedure: [
      "El docente identifica la situacion.",
      "Se separa a los estudiantes involucrados.",
      "Se realiza dialogo pedagogico entre las partes.",
      "Se promueve la mediacion y reconciliacion.",
      "Se establecen compromisos de convivencia.",
      "Se registra el hecho en el observador del estudiante.",
      "El docente realiza seguimiento para evitar repeticion."
    ],
    commitments: [
      "Respetar los acuerdos de convivencia definidos.",
      "Participar en actividades de mediacion y reparacion.",
      "Evitar reincidencia y reportar nuevas situaciones."
    ],
    followups: [
      "Seguimiento docente inicial (fecha: ____ / responsable: ____).",
      "Verificacion de compromisos a 15 dias (fecha: ____ / responsable: ____)."
    ],
    citations: [
      "Citar a acudientes si hay reincidencia (fecha: ____ / medio: ____)."
    ]
  },
  TIPO_II: {
    label: "Tipo II (agresion o acoso escolar)",
    procedure: [
      "El docente informa al coordinador o directivo.",
      "Se realiza registro formal del caso.",
      "Se convoca al Comite Escolar de Convivencia.",
      "Se analiza la situacion y se escuchan las partes.",
      "Se cita a padres o acudientes.",
      "Se establecen acciones pedagogicas o correctivas.",
      "Se realiza seguimiento institucional."
    ],
    commitments: [
      "Compromiso pedagogico firmado por el estudiante.",
      "Plan de apoyo socioemocional y seguimiento.",
      "Cumplir medidas correctivas definidas por el comite."
    ],
    followups: [
      "Seguimiento institucional semanal (fecha: ____ / responsable: ____).",
      "Informe de avance al Comite de Convivencia (fecha: ____)."
    ],
    citations: [
      "Citar a padres/acudientes (fecha: ____ / medio: ____).",
      "Registro en acta del Comite de Convivencia."
    ]
  },
  TIPO_III: {
    label: "Tipo III (situaciones que pueden constituir delito)",
    procedure: [
      "Se protege inmediatamente al estudiante afectado.",
      "Se informa al rector o directivo.",
      "Se activa la Ruta de Atencion Externa.",
      "Se informa a las autoridades competentes.",
      "Se registra el caso en el sistema institucional.",
      "Se realiza seguimiento institucional."
    ],
    commitments: [
      "Garantizar proteccion inmediata del estudiante.",
      "Coordinar con entidades externas y soporte psicosocial.",
      "Registrar avances y decisiones institucionales."
    ],
    followups: [
      "Seguimiento institucional permanente (fecha: ____ / responsable: ____).",
      "Reporte de avances a entidades competentes (fecha: ____)."
    ],
    citations: [
      "Citar a padres/acudientes de forma inmediata (fecha: ____ / medio: ____).",
      "Notificar a ICBF/Policia/Fiscalia segun corresponda."
    ]
  }
};

const academicTemplate = {
  label: "Seguimiento academico",
  procedure: [
    "El docente identifica la dificultad academica.",
    "Se revisa el desempeño y evidencias del estudiante.",
    "Se diseña un plan de apoyo pedagogico.",
    "Se acuerdan estrategias con el estudiante.",
    "Se comunica a padres o acudientes.",
    "Se registra el seguimiento en el observador."
  ],
  commitments: [
    "Cumplir el plan de apoyo y tareas asignadas.",
    "Asistir a refuerzos o tutorias programadas.",
    "Mantener comunicacion con docente y acudientes."
  ],
  followups: [
    "Seguimiento semanal del avance (fecha: ____ / responsable: ____).",
    "Reevaluacion del desempeño a 30 dias (fecha: ____ / responsable: ____)."
  ],
  citations: [
    "Citar a padres/acudientes si persiste la dificultad (fecha: ____ / medio: ____)."
  ]
};

const coexistenceNotificationTemplates: Record<
  CoexistenceProtocolType,
  { title: string; body: string; legalReference: NotificationLegalReference; adminTitle: string; adminBody: string }
> = {
  TIPO_I: {
    title: "Compromiso de corresponsabilidad familia-escuela",
    legalReference: "LEY_115_1994",
    body:
      "Se solicita acompanamiento familiar para fortalecer el proceso formativo, la convivencia y el cumplimiento de acuerdos pedagogicos, en armonia con la Ley 115 de 1994 y Ley 1098 de 2006.",
    adminTitle: "Seguimiento familia-escuela activado",
    adminBody:
      "Se registro una situacion Tipo I. Se recomienda seguimiento docente y corresponsabilidad familia-escuela segun Ley 115 de 1994 y Ley 1098 de 2006."
  },
  TIPO_II: {
    title: "Citacion a Comite Escolar de Convivencia",
    legalReference: "DECRETO_1965_2013",
    body:
      "Se cita al Comite Escolar de Convivencia para analisis y seguimiento del caso reportado, segun Decreto 1965 de 2013. Se solicita presencia puntual y soportes del caso.",
    adminTitle: "Comite Escolar de Convivencia requerido",
    adminBody:
      "Se registro una situacion Tipo II. Debe convocarse el Comite Escolar de Convivencia segun Decreto 1965 de 2013."
  },
  TIPO_III: {
    title: "Activacion de debido proceso escolar",
    legalReference: "LEY_1620_2013",
    body:
      "Se informa la activacion del debido proceso, garantizando el derecho de defensa, contradiccion y acompanamiento familiar, conforme a la Ley 1620 de 2013 y Decreto 1965 de 2013. Favor presentarse en coordinacion para ruta de atencion.",
    adminTitle: "Debido proceso disciplinario activado",
    adminBody:
      "Se registro una situacion Tipo III. Se activa el debido proceso escolar conforme a Ley 1620 de 2013 y Decreto 1965 de 2013."
  }
};

function buildCoexistenceDetail(detail: string, protocol: CoexistenceProtocolType, offense?: string | null) {
  const template = coexistenceTemplates[protocol];
  const lines: string[] = [
    "RUTA INTEGRAL PARA LA CONVIVENCIA ESCOLAR",
    `Protocolo: ${template.label}`,
    `Falta reportada: ${offense || "-"}`,
    "",
    "Descripcion de la situacion:",
    detail,
    "",
    "Procedimiento aplicado:"
  ];

  template.procedure.forEach((line, index) => {
    lines.push(`${index + 1}. ${line}`);
  });

  lines.push("", "Compromisos automaticos:");
  template.commitments.forEach((line) => lines.push(`- ${line}`));

  lines.push("", "Tareas de seguimiento:");
  template.followups.forEach((line) => lines.push(`- [ ] ${line}`));

  lines.push("", "Citaciones y comunicaciones:");
  template.citations.forEach((line) => lines.push(`- [ ] ${line}`));

  return lines.join("\n");
}

function buildAcademicDetail(detail: string) {
  const lines: string[] = [
    "SEGUIMIENTO ACADEMICO",
    "Descripcion de la situacion:",
    detail,
    "",
    "Procedimiento aplicado:"
  ];

  academicTemplate.procedure.forEach((line, index) => lines.push(`${index + 1}. ${line}`));

  lines.push("", "Compromisos automaticos:");
  academicTemplate.commitments.forEach((line) => lines.push(`- ${line}`));

  lines.push("", "Tareas de seguimiento:");
  academicTemplate.followups.forEach((line) => lines.push(`- [ ] ${line}`));

  lines.push("", "Citaciones y comunicaciones:");
  academicTemplate.citations.forEach((line) => lines.push(`- [ ] ${line}`));

  return lines.join("\n");
}

async function triggerCoexistenceNotification(params: {
  protocol: CoexistenceProtocolType;
  student: { id: string; fullName: string; gradeLevel?: string | null; studentGroup?: string | null };
  createdById: string;
  observationDate: Date;
}) {
  const template = coexistenceNotificationTemplates[params.protocol];
  if (!template) return;

  const grade = params.student.gradeLevel ? String(params.student.gradeLevel) : "";
  const group = params.student.studentGroup ? `-${params.student.studentGroup}` : "";
  const studentLabel = params.student.fullName
    ? `Estudiante: ${params.student.fullName}${grade ? ` (${grade}${group})` : ""}`
    : "Estudiante: -";

  const composedBody = composeNotificationBodyWithMeta(
    [studentLabel, `Fecha: ${params.observationDate.toISOString().slice(0, 10)}`, "", template.body].join("\n"),
    "PARENTS",
    template.legalReference
  );
  const adminBody = composeNotificationBodyWithMeta(
    [studentLabel, `Fecha: ${params.observationDate.toISOString().slice(0, 10)}`, "", template.adminBody].join("\n"),
    "ADMINS",
    template.legalReference
  );

  const creator = await prisma.user.findUnique({
    where: { id: params.createdById },
    select: { id: true, role: true }
  });
  const shouldNotifyCreator = creator?.role === "TEACHER";

  const operations = [
    prisma.notification.create({
      data: {
        title: template.title,
        body: composedBody,
        status: "APPROVED",
        createdById: params.createdById,
        approvedById: params.createdById,
        approvedAt: new Date(),
        studentId: params.student.id
      }
    }),
    prisma.notification.create({
      data: {
        title: template.adminTitle,
        body: adminBody,
        status: "APPROVED",
        createdById: params.createdById,
        approvedById: params.createdById,
        approvedAt: new Date(),
        studentId: params.student.id
      }
    })
  ];

  if (shouldNotifyCreator) {
    operations.push(
      prisma.notification.create({
        data: {
          title: template.adminTitle,
          body: composeNotificationBodyWithMeta(
            [studentLabel, `Fecha: ${params.observationDate.toISOString().slice(0, 10)}`, "", template.adminBody].join("\n"),
            "TEACHERS",
            template.legalReference
          ),
          status: "APPROVED",
          createdById: params.createdById,
          approvedById: params.createdById,
          approvedAt: new Date(),
          studentId: params.student.id,
          targetUserId: params.createdById
        }
      })
    );
  }

  const [parentNotification, , teacherNotification] = await prisma.$transaction(operations);

  await enqueueNotification(parentNotification.id);
  if (teacherNotification) {
    await enqueueNotification(teacherNotification.id);
  }
}

async function notifyDisciplinaryProcessIfNeeded(params: {
  student: { id: string; fullName: string; gradeLevel?: string | null; studentGroup?: string | null };
  createdById: string;
}) {
  const latestEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: params.student.id },
    orderBy: [{ year: "desc" }, { id: "desc" }],
    select: { year: true }
  });
  const activeYear = latestEnrollment?.year ?? new Date().getFullYear();
  const yearStart = new Date(`${activeYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${activeYear}-12-31T23:59:59.999Z`);

  const totalTypeIorII = await prisma.studentObservation.count({
    where: {
      studentId: params.student.id,
      type: "COEXISTENCE",
      coexistenceProtocol: { in: ["TIPO_I", "TIPO_II"] },
      date: { gte: yearStart, lte: yearEnd }
    }
  });

  const totalTypeII = await prisma.studentObservation.count({
    where: {
      studentId: params.student.id,
      type: "COEXISTENCE",
      coexistenceProtocol: "TIPO_II",
      date: { gte: yearStart, lte: yearEnd }
    }
  });

  const totalTypeIII = await prisma.studentObservation.count({
    where: {
      studentId: params.student.id,
      type: "COEXISTENCE",
      coexistenceProtocol: "TIPO_III",
      date: { gte: yearStart, lte: yearEnd }
    }
  });

  const reason =
    totalTypeIII >= 1
      ? "1_TIPO_III"
      : totalTypeII === 3
      ? "3_TIPO_II"
      : totalTypeIorII === 3
      ? "3_TIPO_I_II"
      : null;

  if (!reason) return;

  const grade = params.student.gradeLevel ? String(params.student.gradeLevel) : "";
  const group = params.student.studentGroup ? `-${params.student.studentGroup}` : "";
  const studentLabel = params.student.fullName
    ? `Estudiante: ${params.student.fullName}${grade ? ` (${grade}${group})` : ""}`
    : "Estudiante: -";

  const baseMessage =
    reason === "1_TIPO_III"
      ? "Se ha registrado 1 falta de tipo III en el observador."
      : reason === "3_TIPO_II"
      ? "Se han registrado 3 faltas de tipo II en el observador."
      : "Se han registrado 3 faltas de tipo I/II en el observador.";

  const baseLines = [
    studentLabel,
    `Motivo: ${reason}`,
    baseMessage,
    "Se recomienda activar el debido proceso disciplinario segun la Ley 1620 de 2013."
  ];

  const alreadyNotified = async (audience: "ADMINS" | "PARENTS" | "TEACHERS") =>
    (await prisma.notification.count({
      where: {
        studentId: params.student.id,
        title: "Activacion de debido proceso disciplinario",
        createdAt: { gte: yearStart, lte: yearEnd },
        AND: [{ body: { contains: reason } }, { body: { contains: `[[audience:${audience}]]` } }]
      }
    })) > 0;

  const notifications: { id: string }[] = [];

  if (!(await alreadyNotified("ADMINS"))) {
    const adminNotification = await prisma.notification.create({
      data: {
        title: "Activacion de debido proceso disciplinario",
        body: composeNotificationBodyWithMeta(baseLines.join("\n"), "ADMINS", "LEY_1620_2013"),
        status: "APPROVED",
        createdById: params.createdById,
        approvedById: params.createdById,
        approvedAt: new Date(),
        studentId: params.student.id
      }
    });
    notifications.push(adminNotification);
  }

  if (reason === "1_TIPO_III") {
    if (!(await alreadyNotified("PARENTS"))) {
      const parentNotification = await prisma.notification.create({
        data: {
          title: "Activacion de debido proceso disciplinario",
          body: composeNotificationBodyWithMeta(baseLines.join("\n"), "PARENTS", "LEY_1620_2013"),
          status: "APPROVED",
          createdById: params.createdById,
          approvedById: params.createdById,
          approvedAt: new Date(),
          studentId: params.student.id
        }
      });
      notifications.push(parentNotification);
    }

    if (!(await alreadyNotified("TEACHERS"))) {
      const teacherNotification = await prisma.notification.create({
        data: {
          title: "Activacion de debido proceso disciplinario",
          body: composeNotificationBodyWithMeta(baseLines.join("\n"), "TEACHERS", "LEY_1620_2013"),
          status: "APPROVED",
          createdById: params.createdById,
          approvedById: params.createdById,
          approvedAt: new Date(),
          studentId: params.student.id,
          targetUserId: params.createdById
        }
      });
      notifications.push(teacherNotification);
    }
  }

  for (const notification of notifications) {
    await enqueueNotification(notification.id);
  }
}

async function resolveAllowedStudentIdsByRole(auth: { userId: string; role: string }) {
  if (auth.role === "ADMIN" || isDeveloperRole(auth.role)) return null;
  if (auth.role === "TEACHER") {
    const classRows = await prisma.enrollment.findMany({
      where: { class: { teacher: { userId: auth.userId } } },
      select: { studentId: true }
    });
    const teacher = await prisma.teacher.findUnique({
      where: { userId: auth.userId },
      select: { subjectSchedules: true }
    });
    const schedulePairs = teacher ? extractTeacherGradeGroups(teacher.subjectSchedules) : [];
    const uniqueSchedulePairs = Array.from(
      new Set(
        schedulePairs.map((p) => `${normalizeGradeKey(p.gradeLevel)}::${normalizeGroupKey(p.group || "")}`)
      )
    ).map((key) => {
      const [gradeLevel, group] = key.split("::");
      return { gradeLevel, group };
    });

    let scheduleRows: Array<{ studentId: string }> = [];
    if (uniqueSchedulePairs.length > 0) {
      scheduleRows = await prisma.enrollment.findMany({
        where: {
          OR: uniqueSchedulePairs.map((pair) => {
            const normalizedGroup = normalizeGroupKey(pair.group || "");
            const hasGroup = normalizedGroup && normalizedGroup !== "-" && normalizedGroup !== "SIN_GRUPO";
            return {
              class: { gradeLevel: pair.gradeLevel as any },
              ...(hasGroup
                ? { student: { studentGroup: { equals: pair.group, mode: "insensitive" as const } } }
                : {})
            };
          })
        },
        select: { studentId: true }
      });
    }

    return Array.from(
      new Set([...classRows.map((r) => r.studentId), ...scheduleRows.map((r) => r.studentId)])
    );
  }
  const parent = await prisma.parent.findUnique({
    where: { userId: auth.userId },
    select: { id: true, user: { select: { email: true } } }
  });
  if (!parent) return [];
  let guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    select: { studentId: true }
  });
  const parentEmail = String(parent.user?.email || "").trim();
  if (parentEmail) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactEmail: { equals: parentEmail, mode: "insensitive" as const }
      },
      select: { studentId: true, guardianRelation: true }
    });
    if (enrollments.length > 0) {
      await prisma.$transaction(
        enrollments.map((enr) =>
          prisma.guardian.upsert({
            where: {
              parentId_studentId: {
                parentId: parent.id,
                studentId: enr.studentId
              }
            },
            update: { relation: enr.guardianRelation || "Acudiente" },
            create: {
              parentId: parent.id,
              studentId: enr.studentId,
              relation: enr.guardianRelation || "Acudiente"
            }
          })
        )
      );
      guardians = await prisma.guardian.findMany({
        where: { parentId: parent.id },
        select: { studentId: true }
      });
    }
  }
  return Array.from(new Set(guardians.map((g) => g.studentId)));
}

router.get("/", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const studentId = String(req.query.studentId || "").trim();
  const type = String(req.query.type || "").trim();
  const fromDate = String(req.query.fromDate || "").trim();
  const toDate = String(req.query.toDate || "").trim();

  const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
  if (allowedStudentIds && allowedStudentIds.length === 0) {
    return res.json({ data: [], total: 0, page, pageSize });
  }

  if (studentId && allowedStudentIds && !allowedStudentIds.includes(studentId)) {
    return res.status(403).json({ message: "No tienes permisos para consultar este estudiante" });
  }

  const dateGte = normalizeDateStart(fromDate);
  const dateLte = normalizeDateEnd(toDate);

  const where: Prisma.StudentObservationWhereInput = {
    ...(studentId ? { studentId } : {}),
    ...(type ? { type: type as any } : {}),
    ...(dateGte || dateLte
      ? {
          date: {
            ...(dateGte ? { gte: dateGte } : {}),
            ...(dateLte ? { lte: dateLte } : {})
          }
        }
      : {}),
    ...(allowedStudentIds ? { studentId: { in: allowedStudentIds } } : {})
  };

  const [data, total] = await Promise.all([
    prisma.studentObservation.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
        createdBy: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.studentObservation.count({ where })
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/follow-ups", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const days = Math.min(60, Math.max(1, Number(req.query.days || 7)));
  const status = String(req.query.status || "PENDING").trim().toUpperCase();
  const studentId = String(req.query.studentId || "").trim();
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

  const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
  if (allowedStudentIds && allowedStudentIds.length === 0) {
    return res.json({ data: [] });
  }

  if (studentId && allowedStudentIds && !allowedStudentIds.includes(studentId)) {
    return res.status(403).json({ message: "No tienes permisos para consultar este estudiante" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  endDate.setHours(23, 59, 59, 999);

  const where: Prisma.StudentObservationWhereInput = {
    followUpDate: { not: null, ...(status === "PENDING" ? { lte: endDate } : {}) },
    ...(status === "DONE" ? { followUpCompleted: true } : { followUpCompleted: false }),
    ...(studentId ? { studentId } : {}),
    ...(allowedStudentIds ? { studentId: { in: allowedStudentIds } } : {}),
    ...(auth.role === "TEACHER" ? { createdById: auth.userId } : {})
  };

  const data = await prisma.studentObservation.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      createdBy: { select: { id: true, fullName: true, role: true } }
    },
    orderBy: status === "DONE" ? { followUpCompletedAt: "desc" } : { followUpDate: "asc" },
    take: limit
  });

  res.json({ data });
});

router.get("/summary", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const studentId = String(req.query.studentId || "").trim();
  if (!studentId) return res.status(400).json({ message: "studentId requerido" });

  const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
  if (allowedStudentIds && !allowedStudentIds.includes(studentId)) {
    return res.status(403).json({ message: "No tienes permisos para consultar este estudiante" });
  }

  const baseWhere: Prisma.StudentObservationWhereInput = {
    studentId,
    ...(allowedStudentIds ? { studentId: { in: allowedStudentIds } } : {})
  };

  const [total, academic, coexistence, pendingFollowUps] = await Promise.all([
    prisma.studentObservation.count({ where: baseWhere }),
    prisma.studentObservation.count({ where: { ...baseWhere, type: "ACADEMIC" } }),
    prisma.studentObservation.count({ where: { ...baseWhere, type: "COEXISTENCE" } }),
    prisma.studentObservation.count({ where: { ...baseWhere, followUpDate: { not: null }, followUpCompleted: false } })
  ]);

  res.json({ total, academic, coexistence, pendingFollowUps });
});

router.get("/allowed-students", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
  if (allowedStudentIds && allowedStudentIds.length === 0) {
    return res.json([]);
  }

  const students = await prisma.student.findMany({
    where: allowedStudentIds ? { id: { in: allowedStudentIds } } : undefined,
    select: {
      id: true,
      fullName: true,
      gradeLevel: true,
      studentGroup: true,
      enrollments: {
        select: { year: true },
        orderBy: [{ year: "desc" }, { id: "desc" }],
        take: 1
      }
    },
    orderBy: { fullName: "asc" }
  });

  res.json(
    students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      gradeLevel: s.gradeLevel,
      studentGroup: s.studentGroup,
      latestYear: s.enrollments?.[0]?.year || null
    }))
  );
});

router.post("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), validate(createStudentObservationSchema), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const { body } = (req as any).validated;

  const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
  if (allowedStudentIds && !allowedStudentIds.includes(body.studentId)) {
    return res.status(403).json({ message: "No tienes permisos para registrar observaciones para este estudiante" });
  }

  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ message: "Fecha invalida" });
  }
  const followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
  if (body.followUpDate && Number.isNaN(followUpDate?.getTime?.() || NaN)) {
    return res.status(400).json({ message: "Fecha de seguimiento invalida" });
  }

  if (body.type === "COEXISTENCE" && !body.coexistenceProtocol) {
    return res.status(400).json({ message: "El protocolo de convivencia es obligatorio." });
  }
  if (body.type === "COEXISTENCE" && !body.coexistenceOffense) {
    return res.status(400).json({ message: "La falta reportada es obligatoria." });
  }

  const trimmedDetail = body.detail.trim();
  const autoDetail = body.autoDetail !== false;
  let detail = trimmedDetail;
  if (body.type === "COEXISTENCE" && body.coexistenceProtocol && autoDetail) {
    detail = buildCoexistenceDetail(trimmedDetail, body.coexistenceProtocol, body.coexistenceOffense ?? null);
  } else if (body.type === "ACADEMIC" && autoDetail) {
    detail = buildAcademicDetail(trimmedDetail);
  }

  const created = await prisma.studentObservation.create({
    data: {
      studentId: body.studentId,
      createdById: auth.userId,
      date,
      type: body.type,
      coexistenceProtocol: body.type === "COEXISTENCE" ? body.coexistenceProtocol ?? null : null,
      coexistenceOffense: body.type === "COEXISTENCE" ? body.coexistenceOffense?.trim() || null : null,
      ...(followUpDate ? { followUpDate } : {}),
      detail
    },
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      createdBy: { select: { id: true, fullName: true, role: true } }
    }
  });

  if (created.type === "COEXISTENCE" && created.coexistenceProtocol && created.student) {
    triggerCoexistenceNotification({
      protocol: created.coexistenceProtocol,
      student: created.student,
      createdById: auth.userId,
      observationDate: created.date
    }).catch((error) => {
      console.error("No fue posible enviar notificacion automatica de convivencia:", error);
    });
    notifyDisciplinaryProcessIfNeeded({
      student: created.student,
      createdById: auth.userId
    }).catch((error) => {
      console.error("No fue posible enviar notificacion de debido proceso:", error);
    });
  }

  res.json(created);
});

router.patch("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), validate(updateStudentObservationSchema), async (req, res) => {
  const auth = (req as any).auth as { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" };
  const { params, body } = (req as any).validated;

  const current = await prisma.studentObservation.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true, studentId: true }
  });
  if (!current) return res.status(404).json({ message: "Observacion no encontrada" });

  if (auth.role !== "ADMIN" && !isDeveloperRole(auth.role) && current.createdById !== auth.userId) {
    return res.status(403).json({ message: "Solo puedes editar tus propias observaciones" });
  }

  if (auth.role === "TEACHER") {
    const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
    if (allowedStudentIds && !allowedStudentIds.includes(current.studentId)) {
      return res.status(403).json({ message: "No tienes permisos para editar observaciones de este estudiante" });
    }
  }

  const updateData: Prisma.StudentObservationUpdateInput = {
    ...(body.date ? { date: new Date(body.date) } : {}),
    ...(body.type ? { type: body.type } : {}),
    ...(body.detail ? { detail: body.detail.trim() } : {})
  };
  if (body.followUpDate !== undefined) {
    if (!body.followUpDate) {
      updateData.followUpDate = null;
      updateData.followUpCompleted = false;
      updateData.followUpCompletedAt = null;
    } else {
      const nextFollowUp = new Date(body.followUpDate);
      if (Number.isNaN(nextFollowUp.getTime())) {
        return res.status(400).json({ message: "Fecha de seguimiento invalida" });
      }
      updateData.followUpDate = nextFollowUp;
    }
  }
  if (body.followUpCompleted !== undefined) {
    updateData.followUpCompleted = body.followUpCompleted;
    updateData.followUpCompletedAt = body.followUpCompleted ? new Date() : null;
  }

  if (body.coexistenceProtocol !== undefined) {
    updateData.coexistenceProtocol = body.coexistenceProtocol;
  }
  if (body.coexistenceOffense !== undefined) {
    updateData.coexistenceOffense = body.coexistenceOffense.trim();
  } else if (body.type && body.type !== "COEXISTENCE") {
    updateData.coexistenceProtocol = null;
    updateData.coexistenceOffense = null;
  }

  const updated = await prisma.studentObservation.update({
    where: { id: current.id },
    data: updateData,
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      createdBy: { select: { id: true, fullName: true, role: true } }
    }
  });

  res.json(updated);
});

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ message: "Observacion invalida" });

  await prisma.studentObservation.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
