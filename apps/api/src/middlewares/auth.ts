import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  role: "ADMIN" | "TEACHER" | "PARENT" | "DEVELOPER";
}

export interface AuthedRequest extends Request {
  auth?: AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing token" });

  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "") as AuthPayload;
    (req as AuthedRequest).auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: AuthPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as AuthPayload | undefined;
    if (!auth || !roles.includes(auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
