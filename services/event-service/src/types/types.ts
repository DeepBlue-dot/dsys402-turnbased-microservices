import { Request } from "express";
import WebSocket from "ws";

export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  userId?: string;
}

export interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive: boolean;
  wasKicked: boolean;
  sessionId: string; // 🔑 Add this
}

export type PlayerDisconnectedData = {
  userId: string;
};

export type Event<T = any> = {
  type: string;
  data: T;
  occurredAt: string;
};
