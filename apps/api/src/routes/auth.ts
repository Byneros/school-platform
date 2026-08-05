import bcrypt from "bcryptjs";

import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { createHash, randomInt, randomUUID } from "crypto";
import prisma from "../utils/prisma.js";
import { validate } from "../utils/validate.js";
import type { AppRole } from "../utils/rbac.js";
import {
  loginSchema,
  revokeRoleSessionsSchema,
  revokeSessionSchema,
  updateSessionLabelSchema,
  twoFactorResendSchema,
  twoFactorVerifySchema,
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
  rotateRefreshSession,
} from "../utils/refreshTokens.js";
type Role = AppRole;
const router = Router();
const jwtExpiresIn = getAccessTokenTtl();

type LoginAttempt = { count: number; resetAt: number; blockedUntil?: number };
type TwoFactorSession = {
  userId: string;
  role: Role;
  email: string;
  codeHash: string;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
};

const twoFactorEnabledEnv = String(process.env.ADMIN_2FA_ENABLED || "").toLowerCase();
const twoFactorRolesEnv = String(
  process.env.TWO_FACTOR_ROLES || "SUPER_ADMIN,ADMIN,TEACHER,PARENT,DEVELOPER"
);
const isProd = process.env.NODE_ENV === "production";
const twoFactorEnabled = twoFactorEnabledEnv
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

const loginAttempts = new Map<string, LoginAttempt>();
const twoFactorSessions = new Map<string, TwoFactorSession>();

import {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
  Router,
} from "express";

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function ensureAuthConfig() {
  if (!process.env.DATABASE_URL) {
    throw httpError(503, "Servicio de autenticacion no configurado: falta DATABASE_URL.");
  }
  if (!process.env.JWT_SECRET) {
    throw httpError(503, "Servicio de autenticacion no configurado: falta JWT_SECRET.");
  }
}

function cleanupLoginAttempts(now: number) {
  for (const [key, attempt] of loginAttempts.entries()) {
    if (attempt.resetAt <= now && (!attempt.blockedUntil || attempt.blockedUntil <= now)) {
      loginAttempts.delete(key);
    }
  }
}

function getLoginAttemptKey(req: Request, email: string) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return `${ip}:${email}`;
}

function registerFailedLogin(key: string, now: number, current?: LoginAttempt) {
  const nextAttempt =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + loginLockoutWindowMs };
  nextAttempt.count += 1;
  if (nextAttempt.count >= loginLockoutMax) {
    nextAttempt.blockedUntil = now + loginLockoutBlockMs;
  }
  loginAttempts.set(key, nextAttempt);
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
  const subject = "Codigo de verificacion";
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

function signToken(payload: { userId: string; role: Role; schoolId: string | null }) {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret)
    throw httpError(503, "Servicio de autenticacion no configurado: falta JWT_SECRET.");

  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn as any });
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;

  return {
    token,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
  };
}

async function issueSessionTokens(
  res: any,
  req: Request,
  user: {
    id: string;
    role: Role;
    schoolId: string | null;
  }
) {
  const signed = signToken({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
  });

  await createRefreshSession(user.id, req, res);

  return signed;
}

function bearerToken(req: Request) {
  const header = String(req.headers.authorization || "");
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function sessionResponse(user: { role: Role | string; fullName: string; email?: string }) {
  return {
    role: user.role,
    fullName: user.fullName,
    ...(user.email ? { email: user.email } : {}),
  };
}

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req: any, res: Response) => {
    ensureAuthConfig();

    const { email, password } = req.validated.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const now = Date.now();
    cleanupLoginAttempts(now);

    const attemptKey = getLoginAttemptKey(req, normalizedEmail);
    const attempt = loginAttempts.get(attemptKey);
    if (attempt?.blockedUntil && attempt.blockedUntil > now) {
      return res.status(429).json({ error: "Too many login attempts" });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (!user || !user.passwordHash || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(String(password).trim(), user.passwordHash);
    if (!valid) {
      registerFailedLogin(attemptKey, now, attempt);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    loginAttempts.delete(attemptKey);

    if (twoFactorEnabled && twoFactorRoles.has(user.role)) {
      const token = randomUUID();
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = Date.now() + twoFactorCodeTtlMs;

      twoFactorSessions.set(token, {
        userId: user.id,
        role: user.role as Role,
        email: user.email,
        codeHash: hashTwoFactorCode(code),
        expiresAt,
        resendAvailableAt: Date.now() + twoFactorResendCooldownMs,
        attempts: 0,
      });

      const emailSent = await sendTwoFactorCodeEmail(user.email, code);
      if (!emailSent && isProd) {
        twoFactorSessions.delete(token);
        throw httpError(503, "No se pudo enviar el codigo de verificacion.");
      }

      return res.json({
        requiresTwoFactor: true,
        twoFactorToken: token,
        email: user.email,
        role: user.role,
        expiresAt: new Date(expiresAt).toISOString(),
        ...(!emailSent ? { devCode: code } : {}),
      });
    }

    const signed = await issueSessionTokens(res, req, {
      id: user.id,
      role: user.role as Role,
      schoolId: user.schoolId,
    });

    return res.json({
      token: signed.token,
      role: user.role,
      fullName: user.fullName,
      expiresAt: signed.expiresAt,
    });
  })
);

router.post(
  "/2fa/verify",
  validate(twoFactorVerifySchema),
  asyncHandler(async (req: any, res: Response) => {
    ensureAuthConfig();
    cleanupTwoFactorSessions(Date.now());

    const { token, code } = req.validated.body;
    const session = twoFactorSessions.get(token);
    if (!session) return res.status(401).json({ error: "Invalid or expired verification token" });

    if (session.attempts >= twoFactorMaxAttempts) {
      twoFactorSessions.delete(token);
      return res.status(401).json({ error: "Verification attempts exceeded" });
    }

    if (session.codeHash !== hashTwoFactorCode(String(code).trim())) {
      session.attempts += 1;
      return res.status(401).json({ error: "Invalid verification code" });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      twoFactorSessions.delete(token);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const signed = await issueSessionTokens(res, req, {
      id: user.id,
      role: user.role as Role,
      schoolId: user.schoolId,
    });
    twoFactorSessions.delete(token);

    return res.json({
      token: signed.token,
      role: user.role,
      fullName: user.fullName,
      expiresAt: signed.expiresAt,
    });
  })
);

router.post(
  "/2fa/resend",
  validate(twoFactorResendSchema),
  asyncHandler(async (req: any, res: Response) => {
    cleanupTwoFactorSessions(Date.now());

    const { token } = req.validated.body;
    const session = twoFactorSessions.get(token);
    const now = Date.now();
    if (!session) return res.status(401).json({ error: "Invalid or expired verification token" });
    if (session.resendAvailableAt > now) {
      return res.status(429).json({ error: "Wait before requesting another code" });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    session.codeHash = hashTwoFactorCode(code);
    session.expiresAt = now + twoFactorCodeTtlMs;
    session.resendAvailableAt = now + twoFactorResendCooldownMs;
    session.attempts = 0;

    const emailSent = await sendTwoFactorCodeEmail(session.email, code);
    if (!emailSent && isProd) {
      throw httpError(503, "No se pudo enviar el codigo de verificacion.");
    }

    return res.json({
      ok: true,
      expiresAt: new Date(session.expiresAt).toISOString(),
      ...(!emailSent ? { devCode: code } : {}),
    });
  })
);

router.get(
  "/session",
  requireAuth,
  asyncHandler(async (req: any, res: Response) => {
    const auth = req.auth;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, fullName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid token" });
    return res.json(sessionResponse(user));
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req: any, res: Response) => {
    ensureAuthConfig();

    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await prisma.refreshSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive
      ) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      await rotateRefreshSession(session, req, res);

      const signed = signToken({
        userId: session.userId,
        role: session.user.role as Role,
        schoolId: session.user.schoolId,
      });

      return res.json({
        token: signed.token,
        role: session.user.role,
        fullName: session.user.fullName,
        expiresAt: signed.expiresAt,
      });
    }

    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "") as JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid token" });
      const signed = signToken({
        userId: user.id,
        role: user.role,
        schoolId: user.schoolId,
      });
      return res.json({
        token: signed.token,
        role: user.role,
        fullName: user.fullName,
        expiresAt: signed.expiresAt,
      });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  })
);

router.post(
  "/logout",
  asyncHandler(async (req: any, res: Response) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      await revokeRefreshSession(hashRefreshToken(refreshToken));
    }
    clearRefreshCookie(res);
    return res.json({ ok: true });
  })
);

router.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req: any, res: Response) => {
    const auth = req.auth;
    const refreshToken = getRefreshTokenFromRequest(req);
    const currentHash = refreshToken ? hashRefreshToken(refreshToken) : "";
    const sessions = await prisma.refreshSession.findMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      data: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ip: session.ip,
        userAgent: session.userAgent,
        deviceLabel: session.deviceLabel,
        geoCity: session.geoCity,
        geoRegion: session.geoRegion,
        geoCountry: session.geoCountry,
        geoCountryCode: session.geoCountryCode,
        geoTimezone: session.geoTimezone,
        current: Boolean(currentHash && session.tokenHash === currentHash),
      })),
    });
  })
);

router.post(
  "/logout-session",
  requireAuth,
  validate(revokeSessionSchema),
  asyncHandler(async (req: any, res: Response) => {
    await prisma.refreshSession.updateMany({
      where: { id: req.validated.body.sessionId, userId: req.auth.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.json({ ok: true });
  })
);

router.post(
  "/sessions/label",
  requireAuth,
  validate(updateSessionLabelSchema),
  asyncHandler(async (req: any, res: Response) => {
    await prisma.refreshSession.updateMany({
      where: { id: req.validated.body.sessionId, userId: req.auth.userId },
      data: { deviceLabel: String(req.validated.body.label).trim() },
    });
    return res.json({ ok: true });
  })
);

router.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req: any, res: Response) => {
    await revokeAllSessionsForUser(req.auth.userId);
    clearRefreshCookie(res);
    return res.json({ ok: true });
  })
);

router.post(
  "/logout-role",
  requireAuth,
  requireRole(["ADMIN", "DEVELOPER"]),
  validate(revokeRoleSessionsSchema),
  asyncHandler(async (req: any, res: Response) => {
    const result = await prisma.refreshSession.updateMany({
      where: {
        revokedAt: null,
        user: { role: req.validated.body.role },
      },
      data: { revokedAt: new Date() },
    });
    return res.json({ ok: true, revoked: result.count });
  })
);

export default router;
