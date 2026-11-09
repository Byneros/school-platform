import type { Request, Response, NextFunction } from "express";
import { canUseGlobalSchoolContext } from "../utils/schoolContext.js";

export function requireSchoolContext(req: Request, res: Response, next: NextFunction) {
  if (canUseGlobalSchoolContext(req)) {
    return next();
  }

  if (!req.schoolId) {
    return res.status(403).json({
      error: "School context not found.",
    });
  }
  next();
}
