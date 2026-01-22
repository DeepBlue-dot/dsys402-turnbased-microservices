import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, JwtPayload } from "../types/types.js";
import { config } from "../config/env.js";


export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const header = req.headers.authorization;
    
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing or malformed token" });
      return;
    }

    const token = header.split(" ")[1];

    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = payload.userId;

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expired. Please refresh your session." });
      return;
    }
    
    res.status(401).json({ error: "Invalid token" });
  }
};