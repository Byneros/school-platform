import { z } from "zod";

export const createSchoolSchema = z.object({
  body: z.object({
    school: z.object({
      code: z.string().trim().min(2).max(20),
      name: z.string().trim().min(3).max(120),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      website: z.string().optional(),
      nit: z.string().optional(),
    }),

    admin: z.object({
      fullName: z.string().trim().min(3).max(120),
      email: z.string().email(),
      password: z.string().min(8),
    }),
  }),
});

export const updateSchoolSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),

  body: z.object({
    name: z.string().trim().min(3).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    website: z.string().optional(),
    nit: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});
