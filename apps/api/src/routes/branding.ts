import { Router } from "express";
import { z } from "zod";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getBrandingSettings, saveBrandingSettings } from "../utils/brandingSettings.js";
import { sendTabularPdf } from "../utils/reportExport.js";

const router = Router();

const updateBrandingSchema = z.object({
  body: z.object({
    schoolName: z.string().min(1).optional(),
    logoDataUrl: z.string().startsWith("data:image/").nullable().optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    footerText: z.string().min(1).optional()
  })
});

async function isPrincipalAdmin(userId: string) {
  const principalAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return principalAdmin?.id === userId;
}

router.get("/", async (_req, res) => {
  const settings = await getBrandingSettings();
  res.json(settings);
});

router.get("/access", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const canEdit = await isPrincipalAdmin(auth.userId);
  res.json({ canEdit });
});

router.get("/preview-pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "preview-branding.pdf",
    title: "Vista Previa Institucional",
    subtitle: "Ejemplo de formato para reportes academicos",
    branding,
    columns: [
      { key: "student", label: "Estudiante", width: 210 },
      { key: "grade", label: "Grado", width: 100, align: "center" },
      { key: "status", label: "Estado", width: 120, align: "center" }
    ],
    rows: [
      { student: "Ejemplo Alumno 1", grade: "5 Primaria", status: "Activo" },
      { student: "Ejemplo Alumno 2", grade: "8", status: "Activo" },
      { student: "Ejemplo Alumno 3", grade: "11", status: "Pendiente" }
    ]
  });
});

router.get("/preview-pdf/students", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const branding = await getBrandingSettings();
  const students = await prisma.student.findMany({
    select: { fullName: true, gradeLevel: true, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  sendTabularPdf(res, {
    fileName: "preview-branding-students.pdf",
    title: "Vista Previa Institucional (Estudiantes)",
    subtitle: "Top 10 estudiantes mas recientes",
    branding,
    columns: [
      { key: "student", label: "Estudiante", width: 240 },
      { key: "grade", label: "Grado", width: 120, align: "center" },
      { key: "status", label: "Estado", width: 120, align: "center" }
    ],
    rows: students.map((s) => ({
      student: s.fullName,
      grade: s.gradeLevel,
      status: s.isActive ? "Activo" : "Inactivo"
    }))
  });
});

router.put("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const canEdit = await isPrincipalAdmin(auth.userId);
  if (!canEdit) {
    return res.status(403).json({ message: "Solo el administrador principal puede modificar la personalizacion" });
  }

  const parsed = updateBrandingSchema.safeParse({ body: req.body });
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos de personalizacion invalidos", issues: parsed.error.issues });
  }

  const saved = await saveBrandingSettings(parsed.data.body);
  res.json(saved);
});

export default router;
