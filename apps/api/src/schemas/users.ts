import { z } from "zod";

const strongPasswordRule = z
  .string()
  .min(8, "La contrasena debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contrasena debe incluir al menos una letra mayuscula")
  .regex(/[a-z]/, "La contrasena debe incluir al menos una letra minuscula")
  .regex(/[0-9]/, "La contrasena debe incluir al menos un numero")
  .regex(/[^A-Za-z0-9]/, "La contrasena debe incluir al menos un simbolo");

export const createUserSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      password: strongPasswordRule,
      fullName: z.string().min(1),
      role: z.enum(["ADMIN", "TEACHER", "PARENT", "DEVELOPER"]),
      teacherSubjects: z.array(z.string().min(1)).optional(),
      isActive: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.role === "TEACHER" && (!data.teacherSubjects || data.teacherSubjects.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teacherSubjects"],
          message: "Debes asignar al menos una asignatura al crear un docente",
        });
      }
    }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    email: z.string().email().optional(),
    fullName: z.string().min(1).optional(),
    role: z.enum(["ADMIN", "TEACHER", "PARENT", "DEVELOPER"]).optional(),
    isActive: z.boolean().optional(),
    password: strongPasswordRule.optional(),
  }),
});
