import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomInt, randomUUID } from "crypto";
import prisma from "../utils/prisma.js";
import { validate } from "../utils/validate.js";
import {
  loginSchema,
  revokeRoleSessionsSchema,
  revokeSessionSchema,
  updateSessionLabelSchema,
  twoFactorResendSchema,
  twoFactorVerifySchema
} from "../schemas/auth.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { sendEmail } from "../utils/mailer.js";
import { enqueueEmail } from "../services/emailQueue.js";
import {
  clearRefreshCookie,
  createRefreshSession,
  getAccessTokenTtl,
  getRefreshTokenFromRequest,
  hashRefreshToken,
  revokeAllSessionsForUser,
  revokeRefreshSession,
  rotateRefreshSession
} from "../utils/refreshTokens.js";

const router = Router();

const jwtExpiresIn = getAccessTokenTtl();

/* ✅ CENTRALIZACIÓN DE ROLES */
type Role = "ADMIN" | "TEACHER" | "PARENT" | "DEVELOPER";

const twoFactorEnabledEnv = String(process.env.ADMIN_2FA_ENABLED || "").toLowerCase();
const twoFactorRolesEnv = String(process.env.TWO_FACTOR_ROLES || "ADMIN,TEACHER,PARENT");
const isProd = process.env.NODE_ENV === "production";

const twoFactorEnabled =
  twoFactorEnabledEnv
    ? ["true", "1", "yes"].includes(twoFactorEnabledEnv)
    : isProd;

const twoFactorRoles = new Set(
  twoFactorRolesEnv
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean)
);

const twoFactorCodeTtlMs = Math.max(
  60_000,
  Number(process.env.ADMIN_2FA_CODE_TTL_MS || 10 * 60 * 1000)
);

const twoFactorMaxAttempts = Math.max(3, Number(process.env.ADMIN_2FA_MAX_ATTEMPTS || 5));

const twoFactorResendCooldownMs = Math.max(
  30_000,
  Number(process.env.ADMIN_2FA_RESEND_COOLDOWN_MS || 60 * 1000)
);

const twoFactorPepper = process.env.ADMIN_2FA_CODE_SECRET || "";
const queueTwoFactorEmail = String(process.env.EMAIL_QUEUE_2FA || "").toLowerCase() === "true";

const loginLockoutWindowMs = Math.max(
  60_000,
  Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || 15 * 60 * 1000)
);

const loginLockoutMax = Math.max(3, Number(process.env.LOGIN_LOCKOUT_MAX || 5));

const loginLockoutBlockMs = Math.max(
  60_000,
  Number(process.env.LOGIN_LOCKOUT_BLOCK_MS || 15 * 60 * 1000)
);

type LoginAttempt = { count: number; resetAt: number; blockedUntil?: number };

const loginAttempts = new Map<string, LoginAttempt>();

/* ✅ FIX AQUÍ */
type TwoFactorSession = {
  userId: string;
  role: Role;
  email: string;
  codeHash: string;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
};

const twoFactorSessions = new Map<string, TwoFactorSession>();

function cleanupLoginAttempts(now: number) {
  for (const [key, attempt] of loginAttempts.entries()) {
    if (attempt.resetAt <= now && (!attempt.blockedUntil || attempt.blockedUntil <= now)) {
      loginAttempts.delete(key);
    }
  }
}

function getLoginAttemptKey(req: any, email: string) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return `${ip}:${email}`;
}

function cleanupTwoFactorSessions(now: number) {
  for (const [key, session] of twoFactorSessions.entries()) {
    if (session.expiresAt <= now) {
      twoFactorSessions.delete(key);
    }
  }
}

function hashTwoFactorCode(code: string) {
  return createHash("sha256").update(`${code}:${twoFactorPepper}`).digest("hex");
}

async function sendTwoFactorCodeEmail(email: string, code: string) {
  const subject = "Codigo de verificacion (Administrador)";
  const text = `Tu codigo de verificacion es: ${code}\n\nEste codigo expira en 10 minutos.`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2>Codigo de verificacion</h2>
      <p>Tu codigo es:</p>
      <div style="font-size:24px;font-weight:bold;">${code}</div>
    </div>
  `;

  if (queueTwoFactorEmail) {
    const queued = await enqueueEmail({ to: email, subject, text, html });
    if (queued) return true;
  }

  return sendEmail({ to: email, subject, text, html });
}

/* ✅ FIX AQUÍ TAMBIÉN */
function signToken(payload: { userId: string; role: Role }) {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret) throw new Error("JWT_SECRET no configurado");

  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn as any });
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;

  return {
    token,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null
  };
}

async function issueSessionTokens(res: any, req: any, user: { id: string; role: Role }) {
  const signed = signToken({ userId: user.id, role: user.role });
  await createRefreshSession(user.id, req, res);
  return signed;
}

/* ================= LOGIN ================= */

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = (req as any).validated.body;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: "insensitive" } }
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password.trim(), user.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  /* 🔐 2FA */
  if (twoFactorEnabled && twoFactorRoles.has(user.role)) {
    const token = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    twoFactorSessions.set(token, {
      userId: user.id,
      role: user.role as Role,
      email: user.email,
      codeHash: hashTwoFactorCode(code),
      expiresAt: Date.now() + twoFactorCodeTtlMs,
      resendAvailableAt: Date.now() + twoFactorResendCooldownMs,
      attempts: 0
    });

    await sendTwoFactorCodeEmail(user.email, code);

    return res.json({
      requiresTwoFactor: true,
      twoFactorToken: token
    });
  }

  const signed = await issueSessionTokens(res, req, {
    id: user.id,
    role: user.role as Role
  });

  return res.json({
    token: signed.token,
    role: user.role,
    fullName: user.fullName,
    expiresAt: signed.expiresAt
  });
});

export default router;
