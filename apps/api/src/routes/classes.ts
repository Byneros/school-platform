import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/simple", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  const classes = await prisma.class.findMany({
    include: { teacher: { include: { user: true } } },
    orderBy: { id: "asc" }
  });
  const data = classes.map((c) => ({
    ...c,
    gradeLevel: (c as any).gradeLevel || "",
    gradeName: (c as any).gradeLevel || ""
  }));
  res.json(data);
});

router.get("/admin-hours", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const classes = await prisma.class.findMany({
    include: { teacher: { include: { user: true } } },
    orderBy: [{ teacherId: "asc" }, { id: "asc" }]
  });
  const data = classes.map((c) => {
    const schedule = (c.schedule || {}) as Record<string, any>;
    const hoursPerWeek = Number(schedule.hoursPerWeek || 0);
    return {
      classId: c.id,
      teacherId: c.teacherId,
      teacherName: c.teacher.user.fullName,
      teacherEmail: c.teacher.user.email,
      gradeLevel: (c as any).gradeLevel || "",
      gradeId: (c as any).gradeLevel || "",
      gradeName: (c as any).gradeLevel || "",
      hoursPerWeek
    };
  });
  res.json(data);
});

router.put("/:id/hours", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const classId = String(req.params.id || "");
  const hoursPerWeek = Number(req.body?.hoursPerWeek);
  if (!classId) return res.status(400).json({ message: "Clase invalida" });
  if (Number.isNaN(hoursPerWeek) || hoursPerWeek < 0 || hoursPerWeek > 60) {
    return res.status(400).json({ message: "Las horas por semana deben estar entre 0 y 60" });
  }

  const current = await prisma.class.findUnique({ where: { id: classId }, select: { schedule: true } });
  if (!current) return res.status(404).json({ message: "Clase no encontrada" });
  const currentSchedule = (current.schedule || {}) as Record<string, any>;
  const updatedSchedule = { ...currentSchedule, hoursPerWeek };

  const updated = await prisma.class.update({
    where: { id: classId },
    data: { schedule: updatedSchedule },
    include: { teacher: { include: { user: true } } }
  });

  res.json({
    classId: updated.id,
    teacherId: updated.teacherId,
    teacherName: updated.teacher.user.fullName,
    teacherEmail: updated.teacher.user.email,
    gradeLevel: (updated as any).gradeLevel || "",
    gradeId: (updated as any).gradeLevel || "",
    gradeName: (updated as any).gradeLevel || "",
    hoursPerWeek: Number(((updated.schedule || {}) as Record<string, any>).hoursPerWeek || 0)
  });
});

export default router;
