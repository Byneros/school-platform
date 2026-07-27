import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1),
    amount: z.number(),
    paidAt: z.string().datetime(),
    method: z.string().min(1),
    reference: z.string().optional(),
  }),
});
