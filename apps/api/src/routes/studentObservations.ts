import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createStudentObservationSchema, updateStudentObservationSchema } from "../schemas/studentObservations.js";

const router = Router();

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

async function resolveAllowedStudentIdsByRole(auth: { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" }) {
  if (auth.role === "ADMIN") return null;
  if (auth.role === "TEACHER") {
    const rows = await prisma.enrollment.findMany({
      where: { class: { teacher: { userId: auth.userId } } },
      select: { studentId: true }
    });
    return Array.from(new Set(rows.map((r) => r.studentId)));
  }
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  if (!parent) return [];
  const guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    select: { studentId: true }
  });
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

  const created = await prisma.studentObservation.create({
    data: {
      studentId: body.studentId,
      createdById: auth.userId,
      date,
      type: body.type,
      detail: body.detail.trim()
    },
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      createdBy: { select: { id: true, fullName: true, role: true } }
    }
  });

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

  if (auth.role !== "ADMIN" && current.createdById !== auth.userId) {
    return res.status(403).json({ message: "Solo puedes editar tus propias observaciones" });
  }

  if (auth.role === "TEACHER") {
    const allowedStudentIds = await resolveAllowedStudentIdsByRole(auth);
    if (allowedStudentIds && !allowedStudentIds.includes(current.studentId)) {
      return res.status(403).json({ message: "No tienes permisos para editar observaciones de este estudiante" });
    }
  }

  const updated = await prisma.studentObservation.update({
    where: { id: current.id },
    data: {
      ...(body.date ? { date: new Date(body.date) } : {}),
      ...(body.type ? { type: body.type } : {}),
      ...(body.detail ? { detail: body.detail.trim() } : {})
    },
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
