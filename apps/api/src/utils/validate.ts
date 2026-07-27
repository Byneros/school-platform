import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

export function validate<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const issuePath = firstIssue?.path?.join(".") || "field";

      return res.status(400).json({
        message: firstIssue?.message ? `${issuePath}: ${firstIssue.message}` : "Validation error",
        error: "Validation error",
        issues: result.error.issues,
      });
    }

    req.validated = result.data as ZodInfer<TSchema>;

    next();
  };
}
