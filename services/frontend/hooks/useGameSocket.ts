/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/lib/api";
import { getToken } from "@/lib/session";
import type { GameSocketMessage, OutgoingSocketMessage } from "@/lib/types";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

export function useGameSocket(enabled = true) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(enabled);
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
    shouldReconnectRef.current = false;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    socketRef.current?.close();
    socketRef.current = null;
    setConnectionState("closed");
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (socketRef.current?.readyState === WebSocket.CONNECTING) return;

    const token = getToken();
    if (!token) {
      setConnectionState("idle");
      return;
    }

    shouldReconnectRef.current = true;
    setConnectionState(
      reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting",
    );
    setError(null);

    const socket = new WebSocket(getWebSocketUrl(token));
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState("connected");
      setError(null);
      socket.send(JSON.stringify({ type: "SYNC_REQUEST" }));
    };

    socket.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data) as GameSocketMessage);
      } catch {
        setError("Received an unreadable socket message.");
      }
    };

    socket.onerror = () => {
      setConnectionState("error");
      setError("Socket connection error.");
    };

    socket.onclose = () => {
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
  }, [enabled]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    shouldReconnectRef.current = enabled;

    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled]);

  return {
    connect,
    connectionState,
    disconnect,
    error,
    isConnected: connectionState === "connected",
    lastMessage,
    send,
    sync,
  };
}
