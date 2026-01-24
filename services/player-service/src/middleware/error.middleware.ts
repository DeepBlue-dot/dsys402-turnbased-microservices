import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (
  err,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Invalid JSON
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({
      error: "Invalid JSON body",
      message: "Malformed JSON (check commas and quotes)",
    });
    return;
  }

  // Zod validation
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      issues: err.issues.map(e => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  console.error("🔥 Unhandled Error:", err);
  res.status(500).json({ error: "Internal server error" });
};
