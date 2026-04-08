import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(6)
  })
});

export const twoFactorVerifySchema = z.object({
  body: z.object({
    token: z.string().min(10),
    code: z.string().min(4).max(10)
  })
});

export const twoFactorResendSchema = z.object({
  body: z.object({
    token: z.string().min(10)
  })
});

export const revokeRoleSessionsSchema = z.object({
  body: z.object({
    role: z.enum(["ADMIN", "TEACHER", "PARENT"])
  })
});

export const revokeSessionSchema = z.object({
  body: z.object({
    sessionId: z.string().min(6)
  })
});
