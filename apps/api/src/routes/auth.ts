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

type TwoFactorSession = {
  userId: string;
  role: "ADMIN" | "TEACHER" | "PARENT";
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
      <h2 style="margin:0 0 8px;">Codigo de verificacion</h2>
      <p>Tu codigo de verificacion es:</p>
      <div style="font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 12px 0;">${code}</div>
      <p style="color:#64748b;">Este codigo expira en 10 minutos.</p>
    </div>
  `;
  if (queueTwoFactorEmail) {
    const queued = await enqueueEmail({ to: email, subject, text, html });
    if (queued) return true;
  }
  return sendEmail({ to: email, subject, text, html });
}

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

async function issueSessionTokens(res: any, req: any, user: { id: string; role: any }) {
  const signed = signToken({ userId: user.id, role: user.role });
  await createRefreshSession(user.id, req, res);
  return signed;
}

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = (req as any).validated.body;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const now = Date.now();
  const attemptKey = getLoginAttemptKey(req, normalizedEmail);
  cleanupLoginAttempts(now);
  const existingAttempt = loginAttempts.get(attemptKey);
  if (existingAttempt?.blockedUntil && existingAttempt.blockedUntil > now) {
    const retryAfterSec = Math.max(1, Math.ceil((existingAttempt.blockedUntil - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "Too many attempts",
      message: `Demasiados intentos. Intenta de nuevo en ${retryAfterSec} segundos.`
    });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } }
  });
  if (!user || !user.passwordHash) {
    const attempt = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + loginLockoutWindowMs };
    attempt.count += 1;
    attempt.resetAt = now + loginLockoutWindowMs;
    if (attempt.count >= loginLockoutMax) {
      attempt.blockedUntil = now + loginLockoutBlockMs;
    }
    loginAttempts.set(attemptKey, attempt);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.isActive) {
    return res.status(401).json({ error: "Usuario inactivo. Contacta al administrador." });
  }

  const valid = await bcrypt.compare(normalizedPassword, user.passwordHash);
  if (!valid) {
    const attempt = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + loginLockoutWindowMs };
    attempt.count += 1;
    attempt.resetAt = now + loginLockoutWindowMs;
    if (attempt.count >= loginLockoutMax) {
      attempt.blockedUntil = now + loginLockoutBlockMs;
    }
    loginAttempts.set(attemptKey, attempt);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (twoFactorEnabled && twoFactorRoles.has(user.role)) {
    const token = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashTwoFactorCode(code);
    const nowMs = Date.now();
    twoFactorSessions.set(token, {
      userId: user.id,
      role: user.role,
      email: user.email,
      codeHash,
      expiresAt: nowMs + twoFactorCodeTtlMs,
      resendAvailableAt: nowMs + twoFactorResendCooldownMs,
      attempts: 0
    });
    const sent = await sendTwoFactorCodeEmail(user.email, code);
    if (!sent && isProd) {
      twoFactorSessions.delete(token);
      return res.status(503).json({
        error: "No se pudo enviar el codigo",
        message: "El correo no esta configurado. Contacta al administrador del sistema."
      });
    }
    loginAttempts.delete(attemptKey);
    return res.json({
      requiresTwoFactor: true,
      twoFactorToken: token,
      email: user.email,
      role: user.role,
      expiresAt: new Date(nowMs + twoFactorCodeTtlMs).toISOString(),
      ...(sent ? {} : { devCode: code })
    });
  }

  const signed = await issueSessionTokens(res, req, user);
  loginAttempts.delete(attemptKey);

  return res.json({
    token: signed.token,
    role: user.role,
    fullName: user.fullName,
    expiresAt: signed.expiresAt
  });
});

router.post("/2fa/verify", validate(twoFactorVerifySchema), async (req, res) => {
  const { token, code } = (req as any).validated.body;
  const nowMs = Date.now();
  cleanupTwoFactorSessions(nowMs);
  const session = twoFactorSessions.get(token);
  if (!session) {
    return res.status(400).json({ error: "Codigo invalido o expirado" });
  }
  if (session.expiresAt <= nowMs) {
    twoFactorSessions.delete(token);
    return res.status(400).json({ error: "Codigo expirado" });
  }
  if (session.attempts >= twoFactorMaxAttempts) {
    twoFactorSessions.delete(token);
    return res.status(429).json({
      error: "Demasiados intentos",
      message: "Solicita un nuevo codigo."
    });
  }

  const codeHash = hashTwoFactorCode(code.trim());
  if (codeHash !== session.codeHash) {
    session.attempts += 1;
    twoFactorSessions.set(token, session);
    return res.status(401).json({ error: "Codigo incorrecto" });
  }

  twoFactorSessions.delete(token);
  const signed = await issueSessionTokens(res, req, { id: session.userId, role: session.role });
  const userInfo = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, role: true }
  });

  return res.json({
    token: signed.token,
    role: userInfo?.role || session.role,
    fullName: userInfo?.fullName || "",
    expiresAt: signed.expiresAt
  });
});

router.post("/2fa/resend", validate(twoFactorResendSchema), async (req, res) => {
  const { token } = (req as any).validated.body;
  const nowMs = Date.now();
  cleanupTwoFactorSessions(nowMs);
  const session = twoFactorSessions.get(token);
  if (!session) {
    return res.status(400).json({ error: "Sesion expirado" });
  }
  if (session.expiresAt <= nowMs) {
    twoFactorSessions.delete(token);
    return res.status(400).json({ error: "Codigo expirado" });
  }
  if (session.resendAvailableAt > nowMs) {
    const retryAfterSec = Math.max(1, Math.ceil((session.resendAvailableAt - nowMs) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "Espera antes de reenviar",
      message: `Intenta de nuevo en ${retryAfterSec} segundos.`
    });
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  session.codeHash = hashTwoFactorCode(code);
  session.resendAvailableAt = nowMs + twoFactorResendCooldownMs;
  session.attempts = 0;
  twoFactorSessions.set(token, session);
  const sent = await sendTwoFactorCodeEmail(session.email, code);
  if (!sent && isProd) {
    return res.status(503).json({
      error: "No se pudo enviar el codigo",
      message: "El correo no esta configurado. Contacta al administrador del sistema."
    });
  }
  return res.json({
    ok: true,
    ...(sent ? {} : { devCode: code })
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

router.get("/sessions", requireAuth, async (req, res) => {
  const auth = (req as any).auth;
  const token = getRefreshTokenFromRequest(req);
  const currentHash = token ? hashRefreshToken(token) : "";
  const now = new Date();
  const sessions = await prisma.refreshSession.findMany({
    where: {
      userId: auth.userId,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ip: true,
      userAgent: true,
      tokenHash: true,
      deviceLabel: true,
      geoCity: true,
      geoRegion: true,
      geoCountry: true,
      geoCountryCode: true,
      geoTimezone: true
    }
  });

  const data = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    ip: s.ip,
    userAgent: s.userAgent,
    deviceLabel: s.deviceLabel,
    geoCity: s.geoCity,
    geoRegion: s.geoRegion,
    geoCountry: s.geoCountry,
    geoCountryCode: s.geoCountryCode,
    geoTimezone: s.geoTimezone,
    current: currentHash ? s.tokenHash === currentHash : false
  }));

  return res.json({ data });
});

router.post(
  "/sessions/label",
  requireAuth,
  validate(updateSessionLabelSchema),
  async (req, res) => {
    const auth = (req as any).auth;
    const { sessionId, label } = (req as any).validated.body;
    const session = await prisma.refreshSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true }
    });
    if (!session || session.userId !== auth.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    await prisma.refreshSession.update({
      where: { id: sessionId },
      data: { deviceLabel: label }
    });
    return res.json({ ok: true });
  }
);

router.post("/refresh", async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Missing refresh token" });
  }
  const tokenHash = hashRefreshToken(token);
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash }
  });
  if (!session) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  if (session.revokedAt) {
    await revokeAllSessionsForUser(session.userId);
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh token reuse detected" });
  }
  if (session.expiresAt <= new Date()) {
    await revokeRefreshSession(tokenHash);
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh token expired" });
  }
  await rotateRefreshSession(session, req, res);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
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

router.post("/logout", async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (token) {
    const tokenHash = hashRefreshToken(token);
    await revokeRefreshSession(tokenHash);
  }
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

router.post("/logout-all", requireAuth, async (req, res) => {
  const auth = (req as any).auth;
  await revokeAllSessionsForUser(auth.userId);
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

router.post(
  "/logout-role",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(revokeRoleSessionsSchema),
  async (req, res) => {
    const { role } = (req as any).validated.body;
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true }
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) {
      return res.json({ ok: true, revoked: 0 });
    }
    const result = await prisma.refreshSession.updateMany({
      where: { userId: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return res.json({ ok: true, revoked: result.count });
  }
);

router.post(
  "/logout-session",
  requireAuth,
  validate(revokeSessionSchema),
  async (req, res) => {
    const auth = (req as any).auth;
    const { sessionId } = (req as any).validated.body;
    const session = await prisma.refreshSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, tokenHash: true, revokedAt: true }
    });
    if (!session || session.userId !== auth.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (session.revokedAt) {
      return res.json({ ok: true, revoked: false });
    }
    await revokeRefreshSession(session.tokenHash);
    const currentToken = getRefreshTokenFromRequest(req);
    const currentHash = currentToken ? hashRefreshToken(currentToken) : "";
    if (currentHash && currentHash === session.tokenHash) {
      clearRefreshCookie(res);
    }
    return res.json({ ok: true, revoked: true });
  }
);

export default router;
