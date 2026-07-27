import { z } from "zod";

export const createGradeSchema = z.object({
  body: z.object({
    enrollmentId: z.string().min(1),
    period: z.string().min(1),
    name: z.string().min(1),
    aspect: z.enum(["COGNITIVE", "PERSONAL", "SOCIAL"]).default("COGNITIVE"),
    score: z.number(),
    maxScore: z.number(),
  }),
});
