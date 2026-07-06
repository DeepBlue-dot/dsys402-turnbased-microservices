"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getWebSocketUrl } from "@/lib/api";
import { getToken } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";
import type { GameSocketMessage, OutgoingSocketMessage } from "@/lib/types";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

type GameSocketContextValue = {
  connect: () => void;
  connectionState: ConnectionState;
  disconnect: () => void;
  error: string | null;
  isConnected: boolean;
  lastMessage: GameSocketMessage | null;
  send: (message: OutgoingSocketMessage) => boolean;
  sync: () => boolean;
};

const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const socketGenerationRef = useRef(0);
  const connectedUserIdRef = useRef<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [lastMessage, setLastMessage] = useState<GameSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback((message: OutgoingSocketMessage) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected.");
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const sync = useCallback(() => {
    return send({ type: "SYNC_REQUEST" });
  }, [send]);

  const disconnect = useCallback(() => {
    socketGenerationRef.current += 1;
    shouldReconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    connectedUserIdRef.current = null;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    setConnectionState("closed");
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (socketRef.current?.readyState === WebSocket.CONNECTING) return;

    const token = getToken();
    if (!token) {
      setConnectionState("idle");
      return;
    }

    shouldReconnectRef.current = true;
    const socketGeneration = socketGenerationRef.current + 1;
    socketGenerationRef.current = socketGeneration;
    setConnectionState(
      reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting",
    );
    setError(null);

    const socket = new WebSocket(getWebSocketUrl(token));
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketGenerationRef.current !== socketGeneration) return;
      reconnectAttemptsRef.current = 0;
      setConnectionState("connected");
      setError(null);
      socket.send(JSON.stringify({ type: "SYNC_REQUEST" }));
    };

    socket.onmessage = (event) => {
      if (socketGenerationRef.current !== socketGeneration) return;

      try {
        setLastMessage(JSON.parse(event.data) as GameSocketMessage);
      } catch {
        setError("Received an unreadable socket message.");
      }
    };

    socket.onerror = () => {
      if (socketGenerationRef.current !== socketGeneration) return;
      setConnectionState("error");
      setError("Socket connection error.");
    };

    socket.onclose = () => {
      if (socketGenerationRef.current !== socketGeneration) return;
      socketRef.current = null;

      if (!shouldReconnectRef.current) {
        setConnectionState("closed");
        return;
      }

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000);
      setConnectionState("reconnecting");
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!user?.id) {
      // Auth state is the external system this provider mirrors. Closing the
      // socket here is intentional so logout cannot leave a reconnect alive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      disconnect();
      setConnectionState("idle");
      return;
    }

    if (connectedUserIdRef.current && connectedUserIdRef.current !== user.id) {
      disconnect();
    }

    connectedUserIdRef.current = user.id;
    connect();
  }, [connect, disconnect, user?.id]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = useMemo<GameSocketContextValue>(() => ({
    connect,
    connectionState,
    disconnect,
    error,
    isConnected: connectionState === "connected",
    lastMessage,
    send,
    sync,
  }), [
    connect,
    connectionState,
    disconnect,
    error,
    lastMessage,
    send,
    sync,
  ]);

  return (
    <GameSocketContext.Provider value={value}>
      {children}
    </GameSocketContext.Provider>
  );
}

export function useGameSocket(_enabled = true) {
  void _enabled;

  const context = useContext(GameSocketContext);

  if (!context) {
    throw new Error("useGameSocket must be used inside GameSocketProvider.");
  }

  return context;
}
