import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contrasena debe tener minimo 8 caracteres.")
  .regex(/[A-Z]/, "La contrasena debe incluir una mayuscula.")
  .regex(/[a-z]/, "La contrasena debe incluir una minuscula.")
  .regex(/[0-9]/, "La contrasena debe incluir un numero.");

const documentTypeSchema = z.enum(["CC", "TI", "CE", "PASSPORT", "NIT"]);

function validateDocument(docType: z.infer<typeof documentTypeSchema>, docNumber: string) {
  if (docType === "PASSPORT") return /^[A-Za-z0-9-]{5,20}$/.test(docNumber);
  if (docType === "CE") return /^[A-Za-z0-9-]{5,20}$/.test(docNumber);
  return /^[0-9-]{5,20}$/.test(docNumber);
}

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(6),
  }),
});

export const registerSchoolSchema = z.object({
  body: z
    .object({
      school: z.object({
        code: z.string().trim().min(2).max(20),
        name: z.string().trim().min(3).max(120),
        nit: z.string().trim().min(5).max(30),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().max(30).optional().or(z.literal("")),
        address: z.string().trim().max(160).optional().or(z.literal("")),
        website: z.string().trim().url().optional().or(z.literal("")),
      }),
      admin: z.object({
        fullName: z.string().trim().min(3).max(120),
        docType: documentTypeSchema,
        docNumber: z.string().trim().min(5).max(30),
        email: z.string().trim().email(),
        phone: z.string().trim().max(30).optional().or(z.literal("")),
        password: passwordSchema,
        confirmPassword: z.string().min(8),
      }),
    })
    .superRefine((data, ctx) => {
      if (data.admin.password !== data.admin.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["admin", "confirmPassword"],
          message: "La confirmacion de contrasena no coincide.",
        });
      }

      if (!validateDocument(data.admin.docType, data.admin.docNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["admin", "docNumber"],
          message: "El documento no tiene un formato valido.",
        });
      }
    }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().trim().min(32),
      password: passwordSchema,
      confirmPassword: z.string().min(8),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: "La confirmacion de contrasena no coincide.",
    }),
});

export const twoFactorVerifySchema = z.object({
  body: z.object({
    token: z.string().min(10),
    code: z.string().min(4).max(10),
  }),
});

export const twoFactorResendSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

export const revokeRoleSessionsSchema = z.object({
  body: z.object({
    role: z.enum(["ADMIN", "TEACHER", "PARENT", "DEVELOPER"]),
  }),
});

export const revokeSessionSchema = z.object({
  body: z.object({
    sessionId: z.string().min(6),
  }),
});

export const updateSessionLabelSchema = z.object({
  body: z.object({
    sessionId: z.string().min(6),
    label: z.string().trim().min(1).max(40),
  }),
});
