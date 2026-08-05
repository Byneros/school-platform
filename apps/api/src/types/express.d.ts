import type { JwtPayload } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth: JwtPayload;
      schoolId: string | null;
      validated: unknown;
    }
  }
}

export {};
