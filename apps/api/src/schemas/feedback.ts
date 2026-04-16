import { z } from "zod";

export const createFeedbackSchema = z.object({
  body: z.object({
    category: z.enum(["OPINION", "BUG", "SUGGESTION"]),
    title: z.string().trim().min(4).max(120),
    message: z.string().trim().min(10).max(5000)
  })
});

export const reviewFeedbackSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    status: z.enum(["OPEN", "REVIEWED", "CLOSED"]),
    response: z.string().trim().min(3).max(5000)
  })
});
