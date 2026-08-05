import { Router } from "express";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";

import { createSchoolSchema, updateSchoolSchema } from "../schemas/schools.js";

import { listSchools, getSchool, createSchool, updateSchool } from "../services/schoolService.js";

const router = Router();

/**
 * GET /api/schools
 * Listar todos los colegios
 */
router.get("/", requireAuth, requireRole(["SUPER_ADMIN"]), async (_req, res, next) => {
  try {
    const schools = await listSchools();
    res.json(schools);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/schools/:id
 * Obtener un colegio por id
 */
router.get("/:id", requireAuth, requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const school = await getSchool(req.params.id);

    if (!school) {
      return res.status(404).json({
        error: "School not found",
      });
    }

    res.json(school);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/schools
 * Crear colegio
 * (La implementación la haremos en el siguiente sprint)
 */
router.post(
  "/",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  validate(createSchoolSchema),
  async (req, res, next) => {
    try {
      const { body } = (req as any).validated;

      const result = await createSchool(body);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/schools/:id
 * Actualizar colegio
 * (La implementación la haremos en el siguiente sprint)
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  validate(updateSchoolSchema),
  async (req, res, next) => {
    try {
      const { params, body } = (req as any).validated;

      const school = await updateSchool(params.id, body);

      res.json(school);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
