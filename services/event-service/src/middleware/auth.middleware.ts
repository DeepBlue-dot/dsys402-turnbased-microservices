import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/types.js";
import { config } from "../config/env.js";


export const authenticateWS = (token?: string): JwtPayload => {
  if (!token) {
    throw new Error("Missing token");
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return payload;
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    throw new Error("Invalid token");
  }
};
