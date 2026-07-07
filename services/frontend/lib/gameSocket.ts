/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getWebSocketUrl } from "@/lib/api";
import { getToken } from "@/lib/session";
import type {
  ActiveGameState,
  BoardCell,
  ChatItem,
  FeedItem,
  GameOverMessage,
  GameSocketMessage,
  GameSymbol,
  OutgoingSocketMessage,
  PlayerStatus,
  QueueState,
} from "@/lib/types";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

export type GameSocketControllerValue = {
  connect: () => void;
  connectionState: ConnectionState;
  disconnect: () => void;
  error: string | null;
  isConnected: boolean;
  lastMessage: GameSocketMessage | null;
  send: (message: OutgoingSocketMessage) => boolean;
  sync: () => boolean;
  liveStatus: PlayerStatus;
  liveQueue: QueueState | null;
  liveGame: ActiveGameState | null;
  feed: FeedItem[];
  chat: ChatItem[];
  gameOverState: GameOverMessage["data"] | null;
  notice: string | null;
  clearNotice: () => void;
  sendChatMessage: (text: string) => boolean;
};

export function useGameSocketController(userId?: string): GameSocketControllerValue {
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

  const [liveStatus, setLiveStatus] = useState<PlayerStatus>("OFFLINE");
  const [liveQueue, setLiveQueue] = useState<QueueState | null>(null);
  const [liveGame, setLiveGame] = useState<ActiveGameState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [gameOverState, setGameOverState] = useState<GameOverMessage["data"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const liveGameRef = useRef<ActiveGameState | null>(null);
  useEffect(() => {
    liveGameRef.current = liveGame;
  }, [liveGame]);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const addFeedItem = useCallback((title: string, detail: string, symbol?: GameSymbol) => {
    setFeed((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        title,
        detail,
        symbol,
      },
      ...current,
    ].slice(0, 8));
  }, []);

  const addChatItem = useCallback((from: "me" | "opponent" | "system", text: string, status?: "sent" | "failed" | "pending") => {
    setChat((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        from,
        text,
        status,
      },
    ].slice(-30));
  }, []);

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

  const sendChatMessage = useCallback((text: string) => {
    const game = liveGameRef.current;
    if (!game) return false;

    const opponentId = game.opponentId || game.players.find((pid) => pid !== userId);
    if (!opponentId) return false;

    const sent = send({
      type: "CHAT",
      to: opponentId,
      matchId: game.matchId,
      text,
    });

    if (sent) {
      addChatItem("me", text, "pending");
      return true;
    }
    return false;
  }, [addChatItem, send, userId]);

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

    setLiveStatus("OFFLINE");
    setLiveQueue(null);
    setLiveGame(null);
    setFeed([]);
    setChat([]);
    setGameOverState(null);
    setNotice(null);
  }, []);

  const handleIncomingMessageRef = useRef<(message: GameSocketMessage) => void>(() => {});
  useEffect(() => {
    handleIncomingMessageRef.current = (message: GameSocketMessage) => {
      switch (message.type) {
        case "CONNECT_SYNC":
        case "SYNC_RESPONSE": {
          const data = message.data;
          if (data.status) setLiveStatus(data.status);
          if (data.queue !== undefined) setLiveQueue(data.queue);
          if (data.game !== undefined) {
            setLiveGame(data.game);
            if (data.game) {
              setGameOverState(null);
            }
          }
          break;
        }
        case "QUEUE_JOINED": {
          if (message.data.userId === userId) {
            setLiveStatus("QUEUED");
            setLiveQueue({ position: null, waitTimeSeconds: 0 });
          }
          break;
        }
        case "QUEUE_LEFT": {
          if (message.data.userId === userId) {
            setLiveStatus("IDLE");
            setLiveQueue(null);
          }
          break;
        }
        case "MATCH_CREATED": {
          setLiveStatus("IN_GAME");
          setLiveQueue(null);
          setGameOverState(null);
          setChat([]);
          setLiveGame({
            matchId: message.data.matchId,
            players: [userId || "", message.data.opponentId || ""],
            board: Array(9).fill("") as BoardCell[],
            turn: "",
            mySymbol: "X",
            status: "ACTIVE",
            expiresAt: Date.now() + 30000,
            opponentId: message.data.opponentId,
          });
          setFeed([
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              at: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              title: "Match allocated",
              detail: "Opponent found",
            },
          ]);
          break;
        }
        case "GAME_STARTED": {
          setLiveStatus("IN_GAME");
          setLiveQueue(null);
          setGameOverState(null);
          setChat([]);
          setLiveGame({
            matchId: message.data.matchId,
            players: [userId || "", message.data.opponentId],
            board: Array(9).fill("") as BoardCell[],
            turn: message.data.turn,
            mySymbol: message.data.mySymbol,
            status: "ACTIVE",
            expiresAt: message.data.expiresAt,
            opponentId: message.data.opponentId,
          });
          setFeed([
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              at: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              title: "Game started",
              detail: `You are ${message.data.mySymbol}`,
              symbol: message.data.mySymbol,
            },
          ]);
          break;
        }
        case "GAME_TURN": {
          const nextBoard = message.data.board;
          let moveSymbol: GameSymbol | undefined;
          let movePos: number | undefined;
          const currentGame = liveGameRef.current;
          if (currentGame) {
            for (let i = 0; i < 9; i++) {
              if (!currentGame.board[i] && nextBoard[i]) {
                moveSymbol = nextBoard[i] as GameSymbol;
                movePos = i;
                break;
              }
            }
          }
           setLiveGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              board: nextBoard,
              turn: message.data.nextTurn,
              expiresAt: message.data.expiresAt,
              drawProposedBy: message.data.drawProposedBy || null,
            };
          });
          if (moveSymbol !== undefined && movePos !== undefined) {
            const row = Math.floor(movePos / 3) + 1;
            const col = (movePos % 3) + 1;
            addFeedItem(
              `${moveSymbol} placed a mark`,
              `Cell ${movePos + 1}, row ${row}, column ${col}`,
              moveSymbol,
            );
          }
          break;
        }
         case "INVALID_MOVE": {
          setNotice(message.data.reason);
          addFeedItem("Move rejected", message.data.reason);
          break;
        }
        case "GAME_DRAW_PROPOSED": {
          setLiveGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              drawProposedBy: message.data.proposedBy,
            };
          });
          const isFromMe = message.data.proposedBy === userId;
          addFeedItem(
            isFromMe ? "Draw proposed" : "Draw offered",
            isFromMe ? "You proposed a draw" : "Opponent proposed a draw",
          );
          break;
        }
        case "GAME_DRAW_DECLINED": {
          const currentGame = liveGameRef.current;
          const wasProposedByMe = currentGame?.drawProposedBy === userId;
          setLiveGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              drawProposedBy: null,
            };
          });
          addFeedItem(
            "Draw offer declined",
            wasProposedByMe ? "Opponent declined the draw" : "You declined the draw",
          );
          break;
        }
        case "GAME_OVER": {
          setLiveStatus("IDLE");
          setLiveGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              board: message.data.finalBoard,
              status: "ENDED",
            };
          });
          setGameOverState(message.data);
          const reasonFormatted = message.data.reason.replace(/_/g, " ").toLowerCase();
          addFeedItem(
            "Game over",
            `${message.data.result} by ${reasonFormatted}`,
          );
          break;
        }
        case "CHAT_MESSAGE": {
          const isFromMe = message.data.from === userId;
          addChatItem(isFromMe ? "me" : "opponent", message.data.text, "sent");
          break;
        }
        case "chat.status": {
          const isFailed = message.status === "FAILED";
          const reasonFormatted = message.reason ? message.reason.replace(/_/g, " ").toLowerCase() : "";
          addChatItem(
            "system",
            isFailed
              ? `Message failed${reasonFormatted ? `: ${reasonFormatted}` : "."}`
              : "Message delivered.",
            isFailed ? "failed" : "sent",
          );
          if (isFailed) {
            setNotice(reasonFormatted ? `Chat failed: ${reasonFormatted}.` : "Chat message failed.");
          }
          break;
        }
        case "ACK": {
          break;
        }
        case "ERROR":
        case "MATCH_ERROR": {
          const data = message.data;
          const errReason = typeof data === "string"
            ? data
            : data?.reason || message.message || "An error occurred";
          setNotice(errReason);
          break;
        }
        case "DISCONNECTED": {
          setNotice(message.message || "You have been logged in from another device.");
          disconnect();
          break;
        }
      }
    };
  }, [addChatItem, addFeedItem, disconnect, userId]);

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
    setConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
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
        const message = JSON.parse(event.data) as GameSocketMessage;
        setLastMessage(message);
        handleIncomingMessageRef.current(message);
      } catch {
        setError("Received an unreadable socket message.");
      }
    };

    socket.onerror = () => {
      if (socketGenerationRef.current !== socketGeneration) return;
      setConnectionState("error");
      setError("Socket connection error.");
      setLiveStatus("OFFLINE");
    };

    socket.onclose = () => {
      if (socketGenerationRef.current !== socketGeneration) return;
      socketRef.current = null;

      if (!shouldReconnectRef.current) {
        setConnectionState("closed");
        setLiveStatus("OFFLINE");
        return;
      }

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000);
      setConnectionState("reconnecting");
      setLiveStatus("OFFLINE");
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!userId) {
      disconnect();
      setConnectionState("idle");
      return;
    }

    if (connectedUserIdRef.current && connectedUserIdRef.current !== userId) {
      disconnect();
    }

    connectedUserIdRef.current = userId;
    connect();
  }, [connect, disconnect, userId]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return useMemo<GameSocketControllerValue>(() => ({
    connect,
    connectionState,
    disconnect,
    error,
    isConnected: connectionState === "connected",
    lastMessage,
    send,
    sync,
    liveStatus,
    liveQueue,
    liveGame,
    feed,
    chat,
    gameOverState,
    notice,
    clearNotice,
    sendChatMessage,
  }), [
    chat,
    clearNotice,
    connect,
    connectionState,
    disconnect,
    error,
    feed,
    gameOverState,
    lastMessage,
    liveGame,
    liveQueue,
    liveStatus,
    notice,
    send,
    sendChatMessage,
    sync,
  ]);
}
