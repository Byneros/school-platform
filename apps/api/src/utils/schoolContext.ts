import type { Request } from "express";

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
  return req.auth?.role === "SUPER_ADMIN";
}
