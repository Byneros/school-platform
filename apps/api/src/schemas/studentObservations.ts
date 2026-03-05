import { z } from "zod";

const observationTypeSchema = z.enum(["ACADEMIC", "DISCIPLINARY", "COEXISTENCE"]);

export const createStudentObservationSchema = z.object({
  body: z.object({
    studentId: z.string().min(1),
    date: z.string().optional(),
    type: observationTypeSchema,
    detail: z.string().min(5)
  })
});

export const updateStudentObservationSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    date: z.string().optional(),
    type: observationTypeSchema.optional(),
    detail: z.string().min(5).optional()
  })
});
