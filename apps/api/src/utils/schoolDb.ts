import type { Request } from "express";

import prisma from "./prisma.js";
import { canUseGlobalSchoolContext, requireSchool } from "./schoolContext.js";

export function canAccessAllSchools(req: Request): boolean {
  return canUseGlobalSchoolContext(req);
}

export function getSchoolId(req: Request): string {
  return requireSchool(req);
}

export function schoolScope(req: Request) {
  if (canAccessAllSchools(req)) {
    return {};
  }

  return {
    schoolId: getSchoolId(req),
  };
}

export function withSchool<T extends Record<string, unknown>>(
  req: Request,
  data: T
): T & { schoolId: string } {
  return {
    ...data,
    schoolId: getSchoolId(req),
  };
}

export { prisma };

export function studentScope(req: Request) {
  return schoolScope(req);
}

export function teacherScope(req: Request) {
  return schoolScope(req);
}

export function parentScope(req: Request) {
  return schoolScope(req);
}

export function classScope(req: Request) {
  return schoolScope(req);
}

export function enrollmentScope(req: Request) {
  return schoolScope(req);
}

export function admissionScope(req: Request) {
  return schoolScope(req);
}

export function notificationScope(req: Request) {
  return schoolScope(req);
}
