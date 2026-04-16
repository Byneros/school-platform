import { type NextFunction, type Request, type Response } from "express";
import { isDeveloperRole } from "../utils/rbac.js";

function getClientIp(req: Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const rawIp = forwarded || req.ip || req.socket.remoteAddress || "";
  return rawIp.replace(/^::ffff:/, "").trim();
}

function isAllowedDeveloperIp(ip: string) {
  const allowlist = String(process.env.DEVELOPER_IP_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowlist.length === 0) return true;

  return allowlist.some((rule) => {
    if (rule === "*") return true;
    if (rule.endsWith("*")) {
      return ip.startsWith(rule.slice(0, -1));
    }
    return ip === rule;
  });
}

export function requireDeveloper(req: Request, res: Response, next: NextFunction) {
  const auth = (req as any).auth;

  if (!auth || !isDeveloperRole(auth.role)) {
    return res.status(404).json({ error: "Not found" });
  }

  const clientIp = getClientIp(req);
  if (!isAllowedDeveloperIp(clientIp)) {
    console.warn(`Developer route denied by IP: ${clientIp || "unknown"}`);
    return res.status(404).json({ error: "Not found" });
  }

  const expectedToken = String(process.env.DEVELOPER_ACCESS_TOKEN || "").trim();
  if (expectedToken) {
    const providedToken = String(req.headers["x-developer-access-token"] || "").trim();
    if (!providedToken || providedToken !== expectedToken) {
      console.warn(`Developer route denied by token for IP: ${clientIp || "unknown"}`);
      return res.status(404).json({ error: "Not found" });
    }
  }

  next();
}
