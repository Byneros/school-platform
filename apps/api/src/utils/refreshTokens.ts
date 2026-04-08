import { randomBytes, createHash } from "crypto";
import prisma from "./prisma.js";
import type { Request, Response } from "express";

type RefreshSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
};

function getPepper() {
  return process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET || "";
}

export function getRefreshCookieName() {
  return process.env.REFRESH_COOKIE_NAME || "school_refresh";
}

export function getAccessTokenTtl() {
  return process.env.ACCESS_TOKEN_TTL || process.env.JWT_EXPIRES_IN || "8h";
}

export function getRefreshTtlMs() {
  const days = Math.max(1, Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30));
  return days * 24 * 60 * 60 * 1000;
}

export function hashRefreshToken(token: string) {
  const pepper = getPepper();
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function getRefreshTokenFromRequest(req: Request) {
  const name = getRefreshCookieName();
  const cookies = (req as any).cookies || {};
  return String(cookies[name] || "");
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const sameSite = isProd ? "none" : "lax";
  res.cookie(getRefreshCookieName(), token, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    expires: expiresAt,
    path: "/api/auth"
  });
}

export function clearRefreshCookie(res: Response) {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const sameSite = isProd ? "none" : "lax";
  res.clearCookie(getRefreshCookieName(), {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: "/api/auth"
  });
}

export async function createRefreshSession(userId: string, req: Request, res: Response) {
  const token = createRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + getRefreshTtlMs());
  const ip = req.ip || null;
  const userAgent = String(req.headers["user-agent"] || "");

  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ip,
      userAgent
    }
  });

  setRefreshCookie(res, token, expiresAt);
  return token;
}

export async function rotateRefreshSession(
  session: RefreshSessionRecord,
  req: Request,
  res: Response
) {
  const token = createRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + getRefreshTtlMs());
  const ip = req.ip || null;
  const userAgent = String(req.headers["user-agent"] || "");

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenHash: tokenHash
      }
    }),
    prisma.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash,
        expiresAt,
        ip,
        userAgent
      }
    })
  ]);

  setRefreshCookie(res, token, expiresAt);
  return token;
}

export async function revokeRefreshSession(tokenHash: string) {
  await prisma.refreshSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllSessionsForUser(userId: string) {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
