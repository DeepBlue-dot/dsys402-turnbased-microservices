import { Request } from "express";

export interface MatchCreatedEvent {
  event: "match_created";
  matchId: string;
  players: string[];
}


export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  userId?: string; 
}

export type Event<T = any> = {
  type: string;
  data: T;
  occurredAt: string;
};

