import type { Request, Response, NextFunction } from "express";
import { isSuperAdmin } from "../utils/schoolContext";

export function requireSchoolContext(req: Request, res: Response, next: NextFunction) {
  if (isSuperAdmin(req)) {
    return next();
  }

  if (!req.schoolId) {
    return res.status(403).json({
      error: "School context not found.",
    });
  }
  next();
}
