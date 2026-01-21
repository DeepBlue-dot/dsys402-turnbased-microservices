import { Request } from "express";


export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  userId?: string; 
}
