import { z } from "zod";

export const createInvoiceSchema = z.object({
  body: z.object({
    studentId: z.string().min(1),
    amount: z.number(),
    dueDate: z.string().datetime(),
    status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().optional(),
    dueDate: z.string().datetime().optional(),
    status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
  }),
});
