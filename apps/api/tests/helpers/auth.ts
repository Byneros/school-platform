import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

export function authToken(
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "PARENT",
  userId = "test-user",
  schoolId: string | null = "test-school"
) {
  return jwt.sign(
    {
      userId,
      role,
      schoolId,
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "1h",
    }
  );
}
