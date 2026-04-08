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

function isPrivateIp(ip: string) {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const part = Number(ip.split(".")[1] || 0);
    if (part >= 16 && part <= 31) return true;
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

function deriveDeviceLabel(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const os =
    ua.includes("windows") ? "Windows" :
    ua.includes("android") ? "Android" :
    ua.includes("iphone") ? "iPhone" :
    ua.includes("ipad") ? "iPad" :
    ua.includes("mac os x") ? "macOS" :
    ua.includes("linux") ? "Linux" :
    "Dispositivo";

  const browser =
    ua.includes("edg") ? "Edge" :
    ua.includes("chrome") && !ua.includes("edg") ? "Chrome" :
    ua.includes("safari") && !ua.includes("chrome") ? "Safari" :
    ua.includes("firefox") ? "Firefox" :
    ua.includes("opera") || ua.includes("opr/") ? "Opera" :
    "";

  return browser ? `${browser} en ${os}` : os;
}

function normalizeGeoValue(value: any) {
  if (!value) return null;
  const str = String(value).trim();
  return str ? str : null;
}

async function fetchGeo(ip: string) {
  const enabled = String(process.env.IP_GEO_ENABLED || "").toLowerCase() === "true";
  if (!enabled) return null;
  if (!ip || isPrivateIp(ip)) return null;

  const endpoint = process.env.IP_GEO_ENDPOINT || "";
  if (!endpoint) return null;

  const timeoutMs = Math.max(300, Number(process.env.IP_GEO_TIMEOUT_MS || 800));
  const url = endpoint.replace("{ip}", encodeURIComponent(ip));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();

    const city = normalizeGeoValue(data.city || data.city_name || data.location?.city);
    const region = normalizeGeoValue(data.region || data.region_name || data.regionName || data.subdivision);
    const country = normalizeGeoValue(data.country_name || data.country || data.countryName);
    let countryCode = normalizeGeoValue(data.country_code || data.countryCode || data.country_code2 || data.country_code3);
    if (!countryCode && typeof data.country === "string" && data.country.length <= 3) {
      countryCode = data.country;
    }
    const timezone = normalizeGeoValue(data.timezone || data.time_zone || data.timeZone);

    if (!city && !region && !country && !countryCode && !timezone) return null;
    return { city, region, country, countryCode, timezone };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  const deviceLabel = deriveDeviceLabel(userAgent);
  const geo = await fetchGeo(ip || "");

  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ip,
      userAgent,
      deviceLabel,
      geoCity: geo?.city || undefined,
      geoRegion: geo?.region || undefined,
      geoCountry: geo?.country || undefined,
      geoCountryCode: geo?.countryCode || undefined,
      geoTimezone: geo?.timezone || undefined
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
  const deviceLabel = deriveDeviceLabel(userAgent);
  const geo = await fetchGeo(ip || "");

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
        userAgent,
        deviceLabel,
        geoCity: geo?.city || undefined,
        geoRegion: geo?.region || undefined,
        geoCountry: geo?.country || undefined,
        geoCountryCode: geo?.countryCode || undefined,
        geoTimezone: geo?.timezone || undefined
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
