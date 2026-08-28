import type { Request } from "express";
import { isDeveloperRole, isSuperAdminRole } from "./rbac.js";

export function requireSchool(req: Request): string {
  if (!req.schoolId) {
    throw new Error("School context not found.");
  }

  return req.schoolId;
}

export function optionalSchool(req: Request): string | null {
  return req.schoolId ?? null;
}

export function isSuperAdmin(req: Request): boolean {
  return isSuperAdminRole(req.auth?.role);
}

export function canUseGlobalSchoolContext(req: Request): boolean {
  return isSuperAdminRole(req.auth?.role) || isDeveloperRole(req.auth?.role);
}
