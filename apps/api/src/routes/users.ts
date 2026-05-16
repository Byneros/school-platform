import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createUserSchema, updateUserSchema } from "../schemas/users.js";
import bcrypt from "bcryptjs";
import { buildCsvReport, buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { sendEmail } from "../utils/mailer.js";
import { enqueueEmail } from "../services/emailQueue.js";
import { canManageDeveloperUsers, canViewDeveloperUsers, isDeveloperRole } from "../utils/rbac.js";

const router = Router();

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function enrollmentGradeLabel(enrollment: any) {
  return String(enrollment?.class?.gradeLevel || enrollment?.studentGradeLevel || "").trim();
}

function enrollmentGroupLabel(enrollment: any) {
  return String(enrollment?.student?.studentGroup || "").trim();
}

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const search = String(req.query.search || "").trim();
  const role = String(req.query.role || "").trim();
  const where: Prisma.UserWhereInput = {
    email: { not: "docente.sin.asignar@colegio.edu" },
    ...(!canViewDeveloperUsers(auth?.role) ? { role: { not: "DEVELOPER" } } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(role
      ? canViewDeveloperUsers(auth?.role) || role !== "DEVELOPER"
        ? { role: role as any }
        : { id: "__developer-hidden__" }
      : {})
  };
  const [principalAdmin, data, total] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        isActive: true,
        parent: {
          select: {
            guardians: {
              select: {
                relation: true,
                student: {
                  select: {
                    id: true,
                    fullName: true,
                    studentGroup: true,
                    enrollments: {
                      orderBy: [{ year: "desc" }],
                      take: 1,
                      select: {
                        year: true,
                        status: true,
                        studentGradeLevel: true,
                        class: { select: { gradeLevel: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.user.count({ where })
  ]);
  const decorated = data.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.fullName,
    isActive: u.isActive,
    isPrincipal: principalAdmin ? u.id === principalAdmin.id : false,
    relatedStudents:
      u.role === "PARENT"
        ? (u.parent?.guardians || []).map((g) => {
            const latestEnrollment = Array.isArray(g.student?.enrollments) ? g.student.enrollments[0] : null;
            return {
              studentId: g.student?.id || "",
              studentName: g.student?.fullName || "",
              relation: g.relation || "Acudiente",
              grade: enrollmentGradeLabel(latestEnrollment),
              group: enrollmentGroupLabel({ student: g.student }),
              year: Number(latestEnrollment?.year || 0),
              enrollmentStatus: String(latestEnrollment?.status || "")
            };
          })
        : []
  }));
  const canDelete = isDeveloperRole(auth?.role) || (principalAdmin ? auth.userId === principalAdmin.id : false);
  res.json({ data: decorated, total, page, pageSize, canDelete });
});

router.get("/parents/pending-account", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const [enrollments, admissions, parentUsers] = await Promise.all([
    prisma.enrollment.findMany({
      where: { status: { not: "INACTIVE" } },
      select: {
        guardianFullName: true,
        guardianDocNumber: true,
        contactEmail: true,
        guardianRelation: true,
        student: { select: { id: true, fullName: true, studentGroup: true } },
        class: { select: { gradeLevel: true } }
      },
      orderBy: [{ year: "desc" }, { studentFullName: "asc" }]
    }),
    prisma.admission.findMany({
      where: { status: { not: "REJECTED" } },
      select: {
        id: true,
        studentName: true,
        gradeLevel: true,
        guardianFullName: true,
        guardianDocNumber: true,
        guardianRelation: true,
        contactEmail: true
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.user.findMany({
      where: { role: "PARENT" },
      select: {
        fullName: true,
        email: true,
        parent: {
          select: {
            guardians: {
              select: {
                studentId: true
              }
            }
          }
        }
      }
    })
  ]);

  const bucketByKey = new Map<
    string,
    {
      guardianFullName: string;
      guardianDocNumber: string;
      contactEmail: string;
      relation: string;
      students: Array<{ studentId: string; studentName: string; grade: string; group: string }>;
    }
  >();

  for (const e of enrollments) {
    const name = String(e.guardianFullName || "").trim();
    const doc = String(e.guardianDocNumber || "").trim();
    const email = String(e.contactEmail || "").trim().toLowerCase();
    if (!name && !doc && !email) continue;

    const key = doc
      ? `doc:${doc.toLowerCase()}`
      : email
      ? `email:${email}`
      : `name:${name.toLowerCase()}`;

    const current = bucketByKey.get(key) || {
      guardianFullName: name || "Sin nombre",
      guardianDocNumber: doc || "",
      contactEmail: email || "",
      relation: String(e.guardianRelation || "").trim() || "Acudiente",
      students: []
    };

    const studentId = String(e.student?.id || "");
    if (studentId && !current.students.some((s) => s.studentId === studentId)) {
      current.students.push({
        studentId,
        studentName: String(e.student?.fullName || ""),
        grade: String(e.class?.gradeLevel || ""),
        group: String(e.student?.studentGroup || "")
      });
    }
    bucketByKey.set(key, current);
  }

  for (const a of admissions) {
    const name = String(a.guardianFullName || "").trim();
    const doc = String(a.guardianDocNumber || "").trim();
    const email = String(a.contactEmail || "").trim().toLowerCase();
    if (!name && !doc && !email) continue;

    const key = doc
      ? `doc:${doc.toLowerCase()}`
      : email
      ? `email:${email}`
      : `name:${name.toLowerCase()}`;

    const current = bucketByKey.get(key) || {
      guardianFullName: name || "Sin nombre",
      guardianDocNumber: doc || "",
      contactEmail: email || "",
      relation: String(a.guardianRelation || "").trim() || "Acudiente",
      students: []
    };

    const studentId = `admission:${a.id}`;
    if (studentId && !current.students.some((s) => s.studentId === studentId)) {
      current.students.push({
        studentId,
        studentName: String(a.studentName || ""),
        grade: String(a.gradeLevel || ""),
        group: ""
      });
    }
    bucketByKey.set(key, current);
  }

  const parentEmails = new Set(parentUsers.map((p) => normalizeText(p.email)).filter(Boolean));
  const parentStudentIds = new Set(
    parentUsers.flatMap((p) => (p.parent?.guardians || []).map((g) => g.studentId)).filter(Boolean)
  );

  const pending = Array.from(bucketByKey.values())
    .filter((entry) => {
      const byEmail = entry.contactEmail ? parentEmails.has(normalizeText(entry.contactEmail)) : false;
      const byStudentLink = entry.students.some((s) => parentStudentIds.has(s.studentId));
      return !byEmail && !byStudentLink;
    })
    .map((entry) => ({
      guardianFullName: entry.guardianFullName,
      guardianDocNumber: entry.guardianDocNumber,
      contactEmail: entry.contactEmail,
      relation: entry.relation,
      studentsCount: entry.students.length,
      students: entry.students
    }))
    .sort((a, b) => a.guardianFullName.localeCompare(b.guardianFullName, "es"));

  res.json({ data: pending, total: pending.length });
});

router.get("/export/csv", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const auth = (_req as any).auth;
  const users = await prisma.user.findMany({
    where: !canViewDeveloperUsers(auth?.role) ? { role: { not: "DEVELOPER" } } : undefined,
    select: { email: true, fullName: true, role: true, isActive: true }
  });
  const branding = await getBrandingSettings();
  const csv = buildCsvReport({
    title: "Reporte de Usuarios",
    institutionName: branding.schoolName,
    columns: [
      { key: "fullName", label: "Nombre completo" },
      { key: "email", label: "Correo" },
      { key: "role", label: "Rol" },
      { key: "isActive", label: "Estado" }
    ],
    rows: users.map((u) => ({
      ...u,
      isActive: u.isActive ? "Activo" : "Inactivo"
    }))
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"users.csv\"");
  res.send(csv);
});

router.get("/export/excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const auth = (_req as any).auth;
  const users = await prisma.user.findMany({
    where: !canViewDeveloperUsers(auth?.role) ? { role: { not: "DEVELOPER" } } : undefined,
    select: { email: true, fullName: true, role: true, isActive: true }
  });
  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Reporte de Usuarios",
    institutionName: branding.schoolName,
    columns: [
      { key: "fullName", label: "Nombre completo" },
      { key: "email", label: "Correo" },
      { key: "role", label: "Rol" },
      { key: "isActive", label: "Estado" }
    ],
    rows: users.map((u) => ({
      ...u,
      isActive: u.isActive ? "Activo" : "Inactivo"
    }))
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"users-report.xlsx\"");
  res.send(xlsx);
});

router.get("/export/pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const auth = (_req as any).auth;
  const users = await prisma.user.findMany({
    where: !canViewDeveloperUsers(auth?.role) ? { role: { not: "DEVELOPER" } } : undefined,
    select: { email: true, fullName: true, role: true, isActive: true }
  });
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "users.pdf",
    title: "Reporte de Usuarios",
    branding,
    columns: [
      { key: "fullName", label: "Nombre", width: 170 },
      { key: "email", label: "Correo", width: 180 },
      { key: "role", label: "Rol", width: 90, align: "center" },
      { key: "isActive", label: "Estado", width: 80, align: "center" }
    ],
    rows: users.map((u) => ({
      ...u,
      isActive: u.isActive ? "Activo" : "Inactivo"
    }))
  });
});

router.post("/", requireAuth, requireRole(["ADMIN"]), validate(createUserSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;
  if (body.role === "DEVELOPER" && !canManageDeveloperUsers(auth?.role)) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  const normalizedEmail = String(body.email || "").trim().toLowerCase();
  const plainPassword = body.password;
  const passwordHash = await bcrypt.hash(body.password, 10);
  const teacherSubjects: string[] = Array.isArray(body.teacherSubjects)
    ? body.teacherSubjects.map((s: string) => s.trim()).filter(Boolean)
    : [];
  const subjectHoursMap: Record<string, number> = {};
  const subjectSchedulesMap: Record<string, Array<{ dayOfWeek: string; startTime: string; endTime: string; gradeLevel: string; group: string }>> = {};
  const subjectHoursModeMap: Record<string, boolean> = {};
  for (const subject of teacherSubjects) {
    subjectHoursMap[subject] = 0;
    subjectSchedulesMap[subject] = [];
    subjectHoursModeMap[subject] = true;
  }
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: body.fullName,
          role: body.role,
          isActive: body.isActive ?? true
        },
        select: { id: true, email: true, role: true, fullName: true, isActive: true }
      });

      if (body.role === "TEACHER") {
        await tx.teacher.create({
          data: {
            user: { connect: { id: created.id } },
            subjects: teacherSubjects,
            subjectHours: subjectHoursMap as Prisma.InputJsonValue,
            subjectSchedules: subjectSchedulesMap as Prisma.InputJsonValue,
            subjectHoursMode: subjectHoursModeMap as Prisma.InputJsonValue,
            cognitiveWeight: 60,
            personalWeight: 20,
            socialWeight: 20
          }
        });
      }

      if (body.role === "PARENT") {
        await tx.parent.create({
          data: {
            userId: created.id
          }
        });
      }

      return created;
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "El correo ya existe en el sistema" });
    }
    throw error;
  }
  // Enviar correo con credenciales (no bloqueante)
  getBrandingSettings()
    .then((branding) => {
      const payload = {
        to: user.email,
        subject: `Credenciales de acceso - ${branding.schoolName}`,
        text: `Hola ${user.fullName},\n\nTu usuario ha sido creado.\nCorreo: ${user.email}\nContrasena: ${plainPassword}\n\nPor favor cambia la contrasena al ingresar.`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 8px;">
              ${branding.logoDataUrl ? `<img src="${branding.logoDataUrl}" alt="Logo" style="height:40px; width:40px; object-fit:contain;" />` : ""}
              <div style="font-size:16px; font-weight:700; color:${branding.primaryColor};">${branding.schoolName}</div>
            </div>
            <h2 style="margin: 0 0 8px; color:${branding.primaryColor};">Credenciales de acceso</h2>
            <p>Hola <strong>${user.fullName}</strong>,</p>
            <p>Tu usuario ha sido creado. Usa las siguientes credenciales:</p>
            <table style="margin: 12px 0; border-collapse: collapse; width: 100%;">
              <tr>
                <td style="padding: 6px 10px; background: #f1f5f9; border: 1px solid #e2e8f0;">Correo</td>
                <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px; background: #f1f5f9; border: 1px solid #e2e8f0;">Contrasena</td>
                <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${plainPassword}</td>
              </tr>
            </table>
            <p style="color: #475569;">Por favor cambia la contrasena al ingresar.</p>
            <div style="margin-top: 12px; font-size: 12px; color: #64748b;">${branding.footerText || ""}</div>
          </div>
        `
      };
      enqueueEmail(payload)
        .then((queued) => {
          if (!queued) {
            return sendEmail(payload);
          }
          return undefined;
        })
        .catch(() => undefined);
    })
    .catch(() => undefined);
  res.json(user);
});

router.patch("/:id", requireAuth, requireRole(["ADMIN"]), validate(updateUserSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params, body } = (req as any).validated;
  const existingTarget = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true }
  });
  if (!existingTarget) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  if (isDeveloperRole(existingTarget.role) && !canManageDeveloperUsers(auth?.role)) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  if (body.role === "DEVELOPER" && !canManageDeveloperUsers(auth?.role)) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  const principalAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!isDeveloperRole(auth?.role) && principalAdmin && params.id === principalAdmin.id) {
    if (body.isActive === false) {
      return res.status(400).json({ message: "El administrador principal no se puede desactivar" });
    }
    if (body.role && body.role !== "ADMIN") {
      return res.status(400).json({ message: "El administrador principal debe conservar el rol ADMIN" });
    }
  }

  const data: any = { ...body };
  if (typeof data.email === "string") {
    data.email = data.email.trim().toLowerCase();
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
    delete data.password;
  }
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, role: true, fullName: true, isActive: true }
  });
  res.json(user);
});

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const userId = String(req.params.id || "");
  if (!userId) return res.status(400).json({ message: "Usuario invalido" });

  const principalAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (!isDeveloperRole(auth?.role) && principalAdmin && userId === principalAdmin.id) {
    return res.status(400).json({ message: "El administrador principal no se puede eliminar" });
  }
  if (!isDeveloperRole(auth?.role) && (!principalAdmin || auth.userId !== principalAdmin.id)) {
    return res.status(403).json({ message: "Solo el administrador principal puede eliminar usuarios" });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacher: true, parent: true }
  });
  if (!target) return res.status(404).json({ message: "Usuario no encontrado" });
  if (isDeveloperRole(target.role) && !canManageDeveloperUsers(auth?.role)) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  const reassignmentUserId = isDeveloperRole(auth?.role) ? auth.userId : principalAdmin?.id;
  if (!reassignmentUserId) {
    return res.status(500).json({ message: "No se pudo determinar el usuario de reasignacion" });
  }

  await prisma.$transaction(async (tx) => {
    // Reasignar notificaciones al admin principal para conservar trazabilidad
    await tx.notification.updateMany({
      where: { createdById: userId },
      data: { createdById: reassignmentUserId }
    });
    await tx.notification.updateMany({
      where: { approvedById: userId },
      data: { approvedById: reassignmentUserId }
    });
    await tx.notification.updateMany({
      where: { targetUserId: userId },
      data: { targetUserId: null }
    });

    if (target.teacher) {
      // Reasignar clases a un docente "sin asignar" para no perder datos academicos
      const unassignedEmail = "docente.sin.asignar@colegio.edu";
      let unassignedUser = await tx.user.findUnique({
        where: { email: unassignedEmail },
        include: { teacher: true }
      });
      if (!unassignedUser) {
        const passwordHash = await bcrypt.hash("Unassigned123!", 10);
        unassignedUser = await tx.user.create({
          data: {
            email: unassignedEmail,
            passwordHash,
            fullName: "Docente sin asignar",
            role: "TEACHER",
            isActive: false
          },
          include: { teacher: true }
        });
      }
      let unassignedTeacherId = unassignedUser.teacher?.id;
      if (!unassignedTeacherId) {
        const t = await tx.teacher.create({ data: { user: { connect: { id: unassignedUser.id } } } });
        unassignedTeacherId = t.id;
      }
      await tx.class.updateMany({
        where: { teacherId: target.teacher.id },
        data: { teacherId: unassignedTeacherId }
      });
      await tx.teacher.delete({ where: { id: target.teacher.id } });
    }

    if (target.parent) {
      await tx.notificationRecipient.deleteMany({ where: { parentId: target.parent.id } });
      await tx.guardian.deleteMany({ where: { parentId: target.parent.id } });
      await tx.parent.delete({ where: { id: target.parent.id } });
    }

    await tx.user.delete({ where: { id: userId } });
  });

  return res.json({ ok: true });
});

export default router;
