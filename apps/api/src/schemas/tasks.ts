import { z } from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    gradeLevel: z.string().min(1),
    group: z.string().optional(),
    period: z.string().min(1),
    title: z.string().min(1),
    aspect: z.enum(["COGNITIVE", "PERSONAL", "SOCIAL"]).default("COGNITIVE"),
    maxScore: z.number().min(0).max(5)
  })
});

export const upsertTaskScoreSchema = z.object({
  body: z.object({
    taskId: z.string().min(1),
    enrollmentId: z.string().min(1),
    score: z.number().min(0).max(5)
  })
});

export const updateTaskSchema = z
  .object({
    params: z.object({
      id: z.string().min(1)
    }),
    body: z.object({
      title: z.string().min(1).optional(),
      aspect: z.enum(["COGNITIVE", "PERSONAL", "SOCIAL"]).optional(),
      maxScore: z.number().min(0).max(5).optional(),
      period: z.string().min(1).optional()
    })
  })
  .refine((data) => Object.keys(data.body || {}).length > 0, {
    message: "Debe incluir al menos un campo para actualizar"
  });

export const deleteTaskSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  })
});
