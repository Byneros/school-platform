import { z } from "zod";

export const createStudentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1),
    gradeLevel: z.enum([
      "PRE_JARDIN",
      "JARDIN",
      "TRANSICION",
      "PRIMERO",
      "SEGUNDO",
      "TERCERO",
      "CUARTO",
      "QUINTO",
      "SEXTO",
      "SEPTIMO",
      "OCTAVO",
      "NOVENO",
      "DECIMO",
      "ONCE",
    ]),
    studentGroup: z.string().trim().min(1).max(1).optional(),
    birthDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    fullName: z.string().min(1).optional(),
    gradeLevel: z
      .enum([
        "PRE_JARDIN",
        "JARDIN",
        "TRANSICION",
        "PRIMERO",
        "SEGUNDO",
        "TERCERO",
        "CUARTO",
        "QUINTO",
        "SEXTO",
        "SEPTIMO",
        "OCTAVO",
        "NOVENO",
        "DECIMO",
        "ONCE",
      ])
      .optional(),
    studentGroup: z.string().trim().min(1).max(1).optional(),
    birthDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  }),
});
