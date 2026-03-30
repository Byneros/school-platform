import { z } from "zod";

export const createCertificateRequestSchema = z.object({
  body: z.object({
    studentId: z.string().min(1),
    type: z.enum(["STUDY", "ENROLLMENT"])
  })
});

export const reviewCertificateRequestSchema = z.object({});
