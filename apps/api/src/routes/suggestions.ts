import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { isDeveloperRole } from "../utils/rbac.js";
import { schoolScope } from "../utils/schoolDb.js";

const router = Router();
const suggestionsCache = new Map<string, { expiresAt: number; data: any }>();
const cacheTtlMs = 30_000;

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

const gradeOptions = Object.entries(gradeLabels).map(([value, label]) => ({ value, label }));

function gradeLabel(value?: string) {
  return gradeLabels[String(value || "").trim()] || value || "";
}

function normalizeGradeQuery(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/^GRADO_?/g, "");
}

function filterGradeSuggestions(q: string) {
  if (!q) return gradeOptions;
  const normalized = normalizeGradeQuery(q);
  return gradeOptions.filter((g) => {
    const normalizedLabel = normalizeGradeQuery(g.label);
    return g.value.includes(normalized) || normalizedLabel.includes(normalized);
  });
}

function dedupeOptions<T extends { value: string; label: string }>(items: T[]) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = `${item.value}::${item.label}`;
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGradeGroup(gradeLevelRaw: unknown, groupRaw: unknown) {
  const gradeRaw = String(gradeLevelRaw || "")
    .trim()
    .toUpperCase();
  const groupValue = String(groupRaw || "").trim();
  if (gradeRaw.includes("-") && !groupValue) {
    const [grade, ...rest] = gradeRaw
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      gradeLevel: grade || "",
      group: rest.join("-") || "",
    };
  }
  return {
    gradeLevel: gradeRaw,
    group: groupValue,
  };
}

function normalizeGradeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeGroupKey(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTeacherSlots(rawSchedules: unknown) {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object"
      ? (rawSchedules as Record<string, unknown>)
      : {};
  const slots: Array<{ dayOfWeek: string; gradeLevel: string; group: string }> = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const normalized = normalizeGradeGroup(slot?.gradeLevel, slot?.group);
        slots.push({
          dayOfWeek: normalizeDayOfWeek(slot?.dayOfWeek),
          gradeLevel: normalized.gradeLevel,
          group: normalized.group,
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const normalized = normalizeGradeGroup((entry as any)?.gradeLevel, (entry as any)?.group);
      slots.push({
        dayOfWeek: normalizeDayOfWeek((entry as any)?.dayOfWeek),
        gradeLevel: normalized.gradeLevel,
        group: normalized.group,
      });
    }
  });

  return slots.filter((s) => s.dayOfWeek && s.gradeLevel);
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

function getEnrollmentGradeLevel(enrollment: any) {
  return String(enrollment?.class?.gradeLevel || "").trim();
}

router.get("/", requireAuth, async (req, res) => {
  const auth = (req as any).auth;
  const isDeveloper = isDeveloperRole(auth?.role);
  const isAdminLike = auth?.role === "ADMIN" || isDeveloper;
  const type = String(req.query.type || "").trim();
  const q = String(req.query.q || "").trim();
  const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)));
  const qLower = q.toLowerCase();
  const cacheKey = `${auth?.userId || "anon"}:${type}:${qLower}:${limit}`;
  const respond = (data: any) => {
    suggestionsCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, data });
    return res.json(data);
  };
  const cached = suggestionsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  if (!type) return res.status(400).json({ message: "Tipo de sugerencia requerido" });

  if (type === "students") {
    if (!["ADMIN", "TEACHER", "DEVELOPER"].includes(auth?.role)) {
      return res.status(403).json({ message: "Sin permisos" });
    }
    const students = await prisma.student.findMany({
      where: {
        ...schoolScope(req),
        ...(q
          ? {
              fullName: {
                contains: q,
                mode: "insensitive",
              },
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        gradeLevel: true,
        studentGroup: true,
      },
      orderBy: { fullName: "asc" },
      take: limit,
    });

    const options = students.map((s) => ({
      id: s.id,
      value: s.fullName,
      label: `${s.fullName}${s.gradeLevel ? ` - ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}` : ""}`,
      gradeLevel: s.gradeLevel,
      studentGroup: s.studentGroup,
    }));
    const gradeSuggestions = filterGradeSuggestions(q).map((g) => ({
      value: g.value,
      label: `Grado: ${g.label}`,
    }));
    return respond(dedupeOptions([...options, ...gradeSuggestions]).slice(0, limit));
  }

  if (type === "global") {
    if (!["ADMIN", "TEACHER", "PARENT", "DEVELOPER"].includes(auth?.role)) {
      return res.status(403).json({ message: "Sin permisos" });
    }
    const results: Array<{ value: string; label: string; route: string }> = [];
    const normalizedLimit = Math.max(limit, 8);

    if (isAdminLike) {
      const [students, users, admissions] = await Promise.all([
        prisma.student.findMany({
          where: q ? { fullName: { contains: q, mode: "insensitive" } } : {},
          select: { id: true, fullName: true, gradeLevel: true, studentGroup: true },
          orderBy: { fullName: "asc" },
          take: normalizedLimit,
        }),
        prisma.user.findMany({
          where: q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
                ...(!isDeveloper ? { role: { not: "DEVELOPER" } } : {}),
              }
            : !isDeveloper
              ? { role: { not: "DEVELOPER" } }
              : {},
          select: { id: true, fullName: true, email: true, role: true },
          orderBy: { fullName: "asc" },
          take: normalizedLimit,
        }),
        prisma.admission.findMany({
          where: q ? { studentName: { contains: q, mode: "insensitive" } } : {},
          select: { id: true, studentName: true, gradeLevel: true },
          orderBy: { studentName: "asc" },
          take: normalizedLimit,
        }),
      ]);

      students.forEach((s) => {
        results.push({
          value: s.fullName,
          label: `Estudiante: ${s.fullName}${
            s.gradeLevel
              ? ` â€” ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}`
              : ""
          }`,
          route: `/admin/observador?studentId=${s.id}`,
        });
      });

      users.forEach((u) => {
        results.push({
          value: u.fullName,
          label: `Usuario: ${u.fullName} â€” ${u.role}`,
          route: `/admin/usuarios?search=${encodeURIComponent(u.fullName)}`,
        });
        if (u.email) {
          results.push({
            value: u.email,
            label: `Correo: ${u.email}`,
            route: `/admin/usuarios?search=${encodeURIComponent(u.email)}`,
          });
        }
      });

      admissions.forEach((a) => {
        results.push({
          value: a.studentName,
          label: `Admision: ${a.studentName}${a.gradeLevel ? ` â€” ${gradeLabel(a.gradeLevel)}` : ""}`,
          route: `/admin/admisiones?search=${encodeURIComponent(a.studentName)}`,
        });
      });

      return respond(dedupeOptions(results).slice(0, limit));
    }

    if (auth.role === "TEACHER") {
      const students = await prisma.student.findMany({
        where: {
          enrollments: { some: { class: { teacher: { userId: auth.userId } } } },
          ...(q ? { fullName: { contains: q, mode: "insensitive" } } : {}),
        },
        select: { id: true, fullName: true, gradeLevel: true, studentGroup: true },
        orderBy: { fullName: "asc" },
        take: normalizedLimit,
      });
      students.forEach((s) => {
        results.push({
          value: s.fullName,
          label: `Estudiante: ${s.fullName}${
            s.gradeLevel
              ? ` â€” ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}`
              : ""
          }`,
          route: `/teacher/observador?studentId=${s.id}`,
        });
      });
      return respond(dedupeOptions(results).slice(0, limit));
    }

    if (auth.role === "PARENT") {
      const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
      if (!parent) return respond([]);
      const guardians = await prisma.guardian.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      const studentIds = guardians.map((g) => g.studentId);
      if (studentIds.length === 0) return respond([]);
      const students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
          ...(q ? { fullName: { contains: q, mode: "insensitive" } } : {}),
        },
        select: { id: true, fullName: true, gradeLevel: true, studentGroup: true },
        orderBy: { fullName: "asc" },
        take: normalizedLimit,
      });
      students.forEach((s) => {
        results.push({
          value: s.fullName,
          label: `Estudiante: ${s.fullName}${
            s.gradeLevel
              ? ` â€” ${gradeLabel(s.gradeLevel)}${s.studentGroup ? s.studentGroup : ""}`
              : ""
          }`,
          route: `/parent/observador?studentId=${s.id}`,
        });
      });
      return respond(dedupeOptions(results).slice(0, limit));
    }
  }

  if (type === "users") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
            ...(!isDeveloper ? { role: { not: "DEVELOPER" } } : {}),
          }
        : !isDeveloper
          ? { role: { not: "DEVELOPER" } }
          : {},
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: "asc" },
      take: limit,
    });
    const options = users.flatMap((u) => [
      { id: u.id, value: u.fullName, label: `Nombre: ${u.fullName} — ${u.role}` },
      { id: u.id, value: u.email, label: `Correo: ${u.email}` },
    ]);
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "teachers") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const teachers = await prisma.user.findMany({
      where: {
        role: "TEACHER",
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
      take: limit,
    });
    const options = teachers.map((t) => ({
      id: t.id,
      value: t.fullName,
      label: `${t.fullName} (${t.email})`,
      email: t.email,
    }));
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "admissions") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const admissions = await prisma.admission.findMany({
      where: q ? { studentName: { contains: q, mode: "insensitive" } } : {},
      select: { id: true, studentName: true, gradeLevel: true },
      orderBy: { studentName: "asc" },
      take: limit,
    });
    const options = admissions.map((a) => ({
      id: a.id,
      value: a.studentName,
      label: `${a.studentName}${a.gradeLevel ? ` — ${gradeLabel(a.gradeLevel)}` : ""}`,
    }));
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "enrollments") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const enrollments = await prisma.enrollment.findMany({
      where: q
        ? {
            OR: [
              { student: { fullName: { contains: q, mode: "insensitive" } } },
              { guardianFullName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true,
        studentFullName: true,
        guardianFullName: true,
        studentGradeLevel: true,
        student: { select: { fullName: true, studentGroup: true } },
      },
      orderBy: { student: { fullName: "asc" } },
      take: limit,
    });
    const options = enrollments.flatMap((e) => {
      const studentName = e.student?.fullName || e.studentFullName || "";
      const gradeText = e.studentGradeLevel ? gradeLabel(e.studentGradeLevel) : "";
      const group = e.student?.studentGroup ? String(e.student.studentGroup) : "";
      return [
        {
          id: e.id,
          value: studentName,
          label: `Estudiante: ${studentName}${gradeText || group ? ` — ${[gradeText, group].filter(Boolean).join(" ")}` : ""}`,
        },
        {
          id: e.id,
          value: e.guardianFullName || "",
          label: e.guardianFullName ? `Acudiente: ${e.guardianFullName}` : "",
        },
      ].filter((item) => item.value && item.label);
    });
    const gradeSuggestions = filterGradeSuggestions(q).map((g) => ({
      value: g.value,
      label: `Grado: ${g.label}`,
    }));
    return respond(dedupeOptions([...options, ...gradeSuggestions]).slice(0, limit));
  }

  if (type === "invoices") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const invoices = await prisma.invoice.findMany({
      where: q ? { student: { is: { fullName: { contains: q, mode: "insensitive" } } } } : {},
      select: { id: true, status: true, dueDate: true, student: { select: { fullName: true } } },
      orderBy: { dueDate: "desc" },
      take: limit,
    });
    const options = invoices.map((inv) => {
      const name = inv.student?.fullName || "";
      const due = inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "";
      const suffix = [inv.status, due ? `vence ${due}` : ""].filter(Boolean).join(" · ");
      return {
        id: inv.id,
        value: name,
        label: suffix ? `${name} — ${suffix}` : name,
      };
    });
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "payments") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const payments = await prisma.payment.findMany({
      where: q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } },
              { invoice: { student: { fullName: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {},
      select: {
        id: true,
        paidAt: true,
        invoice: { select: { student: { select: { fullName: true } } } },
      },
      orderBy: { paidAt: "desc" },
      take: limit,
    });
    const options = payments.flatMap((p) => {
      const name = p.invoice?.student?.fullName || "";
      return [
        { id: p.id, value: p.id, label: name ? `Pago: ${p.id} — ${name}` : `Pago: ${p.id}` },
        { id: p.id, value: name, label: name ? `Estudiante: ${name}` : "" },
      ].filter((item) => item.value && item.label);
    });
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "academic-closure") {
    if (!isAdminLike) return res.status(403).json({ message: "Sin permisos" });
    const enrollments = await prisma.enrollment.findMany({
      where: q ? { studentFullName: { contains: q, mode: "insensitive" } } : {},
      select: {
        id: true,
        studentFullName: true,
        studentGradeLevel: true,
        student: { select: { fullName: true, studentGroup: true } },
      },
      orderBy: { student: { fullName: "asc" } },
      take: limit,
    });
    const options = enrollments.map((e) => {
      const studentName = e.student?.fullName || e.studentFullName || "";
      const gradeText = e.studentGradeLevel ? gradeLabel(e.studentGradeLevel) : "";
      const group = e.student?.studentGroup ? String(e.student.studentGroup) : "";
      const suffix = [gradeText, group].filter(Boolean).join(" ");
      return {
        id: e.id,
        value: studentName,
        label: suffix ? `${studentName} - ${suffix}` : studentName,
      };
    });
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "teacher-grades") {
    if (auth?.role !== "TEACHER") return res.status(403).json({ message: "Sin permisos" });
    const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
    if (!teacher) return respond([]);
    const grades = await prisma.grade.findMany({
      where: {
        enrollment: { class: { teacherId: teacher.id } },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { enrollment: { include: { class: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 4, 20),
    });
    const options: Array<{ value: string; label: string }> = [];
    grades.forEach((g) => {
      const gradeValue = getEnrollmentGradeLevel(g.enrollment);
      const gradeText = gradeValue ? gradeLabel(gradeValue) : "";
      const name = String(g.name || "").trim();
      const matchesQuery =
        !qLower ||
        name.toLowerCase().includes(qLower) ||
        gradeValue.toLowerCase().includes(qLower) ||
        gradeText.toLowerCase().includes(qLower);
      if (!matchesQuery) return;
      if (name) options.push({ value: name, label: `Evaluacion: ${name}` });
      if (gradeValue)
        options.push({
          value: gradeText || gradeValue,
          label: `Grado: ${gradeText || gradeValue}`,
        });
    });
    const unique = dedupeOptions(options);
    const recentFirst = unique.slice(0, limit);
    return respond(recentFirst);
  }

  if (type === "teacher-enrollments") {
    if (auth?.role !== "TEACHER") return res.status(403).json({ message: "Sin permisos" });
    const teacher = await prisma.teacher.findUnique({
      where: { userId: auth.userId },
      select: { id: true, subjectSchedules: true },
    });
    if (!teacher) return respond([]);
    const dayOfWeek = dayOfWeekInSpanishUpper();
    const slots = normalizeTeacherSlots(teacher.subjectSchedules);
    const scopedSlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    const targetSlots = scopedSlots.length > 0 ? scopedSlots : slots;
    if (targetSlots.length === 0) return respond([]);

    const uniquePairs = Array.from(
      new Set(
        targetSlots.map(
          (s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`
        )
      )
    ).map((key) => {
      const [gradeLevel, group] = key.split("::");
      return { gradeLevel, group };
    });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        OR: uniquePairs.map((pair) => ({
          class: { gradeLevel: pair.gradeLevel as any },
          ...(pair.group && pair.group !== "-"
            ? { student: { studentGroup: { equals: pair.group, mode: "insensitive" as const } } }
            : {}),
        })),
      },
      include: { student: true, class: true },
    });

    const options: Array<{ value: string; label: string }> = [];
    enrollments.forEach((e) => {
      const studentName = String(e.student?.fullName || e.studentFullName || "").trim();
      const grade = String(getEnrollmentGradeLevel(e) || e.studentGradeLevel || "").trim();
      const group = String(e.student?.studentGroup || "").trim();
      const matchesQuery =
        !qLower ||
        studentName.toLowerCase().includes(qLower) ||
        grade.toLowerCase().includes(qLower);
      if (!matchesQuery) return;
      if (studentName) {
        options.push({
          value: studentName,
          label: `Estudiante: ${studentName}${grade || group ? ` — ${[grade, group].filter(Boolean).join(" ")}` : ""}`,
        });
      }
      if (grade) {
        options.push({
          value: grade,
          label: `Grado: ${grade}`,
        });
      }
    });
    return respond(dedupeOptions(options).slice(0, limit));
  }

  if (type === "parent-grades") {
    if (auth?.role !== "PARENT") return res.status(403).json({ message: "Sin permisos" });
    const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
    if (!parent) return respond([]);
    const guardians = await prisma.guardian.findMany({
      where: { parentId: parent.id },
      select: { studentId: true },
    });
    const studentIds = guardians.map((g) => g.studentId);
    if (studentIds.length === 0) return respond([]);
    const grades = await prisma.grade.findMany({
      where: { enrollment: { studentId: { in: studentIds } } },
      include: { enrollment: { include: { class: true, student: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 6, 30),
    });
    const grouped = new Map<
      string,
      {
        student: string;
        grade: string;
        group: string;
        period: string;
        subject: string;
        maxScore: number;
        sum: number;
        count: number;
      }
    >();
    grades.forEach((g) => {
      const enrollment = g.enrollment;
      if (!enrollment) return;
      const subject = String(g.name || "").trim();
      if (!subject) return;
      const gradeValue = getEnrollmentGradeLevel(enrollment);
      const gradeText = gradeValue ? gradeLabel(gradeValue) : "";
      const groupText = String(enrollment.student?.studentGroup || "").trim();
      const studentName = String(
        enrollment.student?.fullName || enrollment.studentFullName || ""
      ).trim();
      const key = `${enrollment.id}::${g.period}::${subject}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          student: studentName,
          grade: gradeText,
          group: groupText,
          period: String(g.period || ""),
          subject,
          maxScore: Number(g.maxScore || 0),
          sum: 0,
          count: 0,
        });
      }
      const entry = grouped.get(key)!;
      const currentMax = Number(g.maxScore || 0);
      if (entry.maxScore <= 0 && currentMax > 0) entry.maxScore = currentMax;
      const baseMax = entry.maxScore || currentMax;
      const normalized = currentMax > 0 ? (Number(g.score) / currentMax) * baseMax : 0;
      entry.sum += normalized;
      entry.count += 1;
    });

    const options: Array<{ value: string; label: string }> = [];
    grouped.forEach((entry) => {
      const scoreValue = entry.count ? entry.sum / entry.count : 0;
      const scoreText = `${scoreValue.toFixed(2)}/${entry.maxScore || 0}`;
      const matchesQuery =
        !qLower ||
        entry.student.toLowerCase().includes(qLower) ||
        entry.grade.toLowerCase().includes(qLower) ||
        entry.group.toLowerCase().includes(qLower) ||
        entry.subject.toLowerCase().includes(qLower) ||
        entry.period.toLowerCase().includes(qLower) ||
        scoreText.toLowerCase().includes(qLower);
      if (!matchesQuery) return;
      if (entry.student)
        options.push({ value: entry.student, label: `Estudiante: ${entry.student}` });
      if (entry.grade) options.push({ value: entry.grade, label: `Grado: ${entry.grade}` });
      if (entry.group) options.push({ value: entry.group, label: `Grupo: ${entry.group}` });
      if (entry.subject)
        options.push({ value: entry.subject, label: `Asignatura: ${entry.subject}` });
      if (entry.period) options.push({ value: entry.period, label: `Periodo: ${entry.period}` });
      options.push({ value: scoreText, label: `Nota definitiva: ${scoreText}` });
    });
    const unique = dedupeOptions(options);
    const recentFirst = unique.slice(0, limit);
    return respond(recentFirst);
  }

  if (type === "parent-invoices") {
    if (auth?.role !== "PARENT") return res.status(403).json({ message: "Sin permisos" });
    const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
    if (!parent) return respond([]);
    const guardians = await prisma.guardian.findMany({
      where: { parentId: parent.id },
      select: { studentId: true },
    });
    const studentIds = guardians.map((g) => g.studentId);
    if (studentIds.length === 0) return respond([]);
    const invoices = await prisma.invoice.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 4, 20),
    });
    const options: Array<{ value: string; label: string }> = [];
    invoices.forEach((inv) => {
      const amountText = `$ ${inv.amount}`;
      const matchesQuery =
        !qLower ||
        inv.id.toLowerCase().includes(qLower) ||
        inv.status.toLowerCase().includes(qLower) ||
        amountText.toLowerCase().includes(qLower);
      if (!matchesQuery) return;
      options.push({ value: inv.id, label: `Factura: ${inv.id}` });
      options.push({ value: inv.status, label: `Estado: ${inv.status}` });
      options.push({ value: amountText, label: `Monto: ${amountText}` });
    });
    const unique = dedupeOptions(options);
    const recentFirst = unique.slice(0, limit);
    return respond(recentFirst);
  }

  if (type === "parent-notifications") {
    if (auth?.role !== "PARENT") return res.status(403).json({ message: "Sin permisos" });
    const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
    if (!parent) return respond([]);
    const items = await prisma.notificationRecipient.findMany({
      where: { parentId: parent.id },
      include: { notification: true },
      orderBy: { notification: { createdAt: "desc" } },
      take: Math.max(limit * 4, 20),
    });
    const options: Array<{ value: string; label: string }> = [];
    items.forEach((item) => {
      const notification = item.notification;
      if (!notification) return;
      const dateText = notification.createdAt?.toISOString?.().slice(0, 10) || "";
      const title = String(notification.title || "").trim();
      const status = String(notification.status || "").trim();
      const matchesQuery =
        !qLower ||
        title.toLowerCase().includes(qLower) ||
        status.toLowerCase().includes(qLower) ||
        dateText.toLowerCase().includes(qLower);
      if (!matchesQuery) return;
      if (title) options.push({ value: title, label: `Titulo: ${title}` });
      if (status) options.push({ value: status, label: `Estado: ${status}` });
      if (dateText) options.push({ value: dateText, label: `Fecha: ${dateText}` });
    });
    const unique = dedupeOptions(options);
    const recentFirst = unique.slice(0, limit);
    return respond(recentFirst);
  }

  return res.status(400).json({ message: "Tipo de sugerencia no soportado" });
});

export default router;
