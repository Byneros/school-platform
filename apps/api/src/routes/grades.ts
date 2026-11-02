import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { requireSchoolContext } from "../middlewares/requireSchoolContext.js";
import { validate } from "../utils/validate.js";
import { createGradeSchema } from "../schemas/grades.js";
import { schoolScope } from "../utils/schoolDb.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole(["TEACHER"]),
  requireSchoolContext,
  validate(createGradeSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const auth = (req as any).auth;
    const teacher = await prisma.teacher.findFirst({
      where: { userId: auth.userId, ...schoolScope(req) },
      select: { id: true },
    });
    if (!teacher) return res.status(403).json({ error: "Docente no encontrado" });

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: body.enrollmentId,
        ...schoolScope(req),
        class: { teacherId: teacher.id },
      },
      select: { id: true },
    });
    if (!enrollment) return res.status(404).json({ error: "Matricula no encontrada" });

    const grade = await prisma.grade.create({ data: body });
    res.json(grade);
  }
);

export default router;
