export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email?: string;
  password?: string;
}

export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface VerifyResult {
  valid: boolean;
  user?: any;
  error?: string;
}

import { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string; 
}
