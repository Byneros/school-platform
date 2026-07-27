import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createGradeSchema } from "../schemas/grades.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole(["TEACHER"]),
  validate(createGradeSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const grade = await prisma.grade.create({ data: body });
    res.json(grade);
  }
);

export default router;
