declare module "cookie-parser" {
  import type { RequestHandler } from "express";

  type CookieParser = (secret?: string | string[], options?: unknown) => RequestHandler;

  const cookieParser: CookieParser;

  export default cookieParser;
}
