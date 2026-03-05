import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { validate } from "../utils/validate.js";
import { loginSchema } from "../schemas/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";

function signToken(payload: { userId: string; role: "ADMIN" | "TEACHER" | "PARENT" }) {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret) {
    throw new Error("JWT_SECRET no configurado");
  }
  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn as any });
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  return {
    token,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null
  };
}

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = (req as any).validated.body;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } }
  });
  if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.isActive) return res.status(401).json({ error: "Usuario inactivo. Contacta al administrador." });

  const valid = await bcrypt.compare(normalizedPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const signed = signToken({ userId: user.id, role: user.role });

  return res.json({
    token: signed.token,
    role: user.role,
    fullName: user.fullName,
    expiresAt: signed.expiresAt
  });
});

router.get("/session", requireAuth, async (req, res) => {
  const auth = (req as any).auth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, role: true, fullName: true, isActive: true }
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid session" });
  }
  return res.json({ email: user.email, role: user.role, fullName: user.fullName });
});

router.post("/refresh", requireAuth, async (req, res) => {
  const auth = (req as any).auth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, role: true, fullName: true, isActive: true }
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const signed = signToken({ userId: user.id, role: user.role });
  return res.json({
    token: signed.token,
    role: user.role,
    fullName: user.fullName,
    expiresAt: signed.expiresAt
  });
});

export default router;
