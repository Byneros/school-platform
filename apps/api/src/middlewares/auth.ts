import type { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";

import type { AuthenticatedRequest, JwtPayload } from "../types";

import { hasRequiredRole, type AppRole } from "../utils/rbac.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "") as JwtPayload;

    req.auth = payload;

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid token",
    });
  }
}

export function requireRole(roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;

    if (!auth || !hasRequiredRole(auth.role, roles)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  };
}
