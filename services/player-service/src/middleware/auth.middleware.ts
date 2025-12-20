import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    const token = header.replace("Bearer ", "");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as any;

    (req as any).userId = payload.userId;

    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
