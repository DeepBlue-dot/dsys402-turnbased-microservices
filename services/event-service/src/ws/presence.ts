import WebSocket from "ws";

export interface ConnectionMeta {
  socket: WebSocket;
  isAlive: boolean;
  missedPings: number;
}

export const connections = new Map<string, ConnectionMeta>();
