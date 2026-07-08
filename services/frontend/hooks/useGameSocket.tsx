"use client";

import { createContext, useContext, useMemo, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocketController } from "@/lib/gameSocket";
import type {
  ActiveGameState,
  ChatItem,
  FeedItem,
  GameOverMessage,
  GameSocketMessage,
  OutgoingSocketMessage,
  PlayerStatus,
  QueueState,
} from "@/lib/types";

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
  liveStatus: PlayerStatus;
  liveQueue: QueueState | null;
  liveGame: ActiveGameState | null;
  feed: FeedItem[];
  chat: ChatItem[];
  gameOverState: GameOverMessage["data"] | null;
  ratingUpdate: {
    matchId: string;
    ratingChange: number;
    newRating: number;
  } | null;
  notice: string | null;
  clearNotice: () => void;
  sendChatMessage: (text: string) => boolean;
  rematchState: {
    matchId: string;
    status: "idle" | "pending" | "accepted" | "expired";
    requestedBy: string;
  } | null;
  requestRematch: (matchId: string) => boolean;
  declineRematch: (matchId: string) => boolean;
};

const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const socketState = useGameSocketController(user?.id);
  const lastHandledRef = useRef<GameSocketMessage | null>(null);

  useEffect(() => {
    const lastMessage = socketState.lastMessage;
    if (!user?.id || !lastMessage) return;
    if (lastHandledRef.current === lastMessage) return;
    lastHandledRef.current = lastMessage;

    const event = lastMessage.type;
    const redirectEvents = new Set([
      "MATCH_CREATED",
      "GAME_STARTED",
      "GAME_TURN",
      "GAME_DRAW_PROPOSED",
      "GAME_DRAW_DECLINED",
      "GAME_OVER",
      "REMATCH_STATUS",
      "REMATCH_EXPIRED",
    ]);

    if (!redirectEvents.has(event)) return;

    const currentPath = typeof window !== "undefined" ? window.location.pathname : pathname;
    if (currentPath && !currentPath.startsWith("/dashboard")) {
      router.replace("/dashboard");
    }
  }, [socketState.lastMessage, router, socketState.liveGame, user?.id]);

  const value = useMemo<GameSocketContextValue>(() => ({
    connect: socketState.connect,
    connectionState: socketState.connectionState as ConnectionState,
    disconnect: socketState.disconnect,
    error: socketState.error,
    isConnected: socketState.isConnected,
    lastMessage: socketState.lastMessage,
    send: socketState.send,
    sync: socketState.sync,
    liveStatus: socketState.liveStatus,
    liveQueue: socketState.liveQueue,
    liveGame: socketState.liveGame,
    feed: socketState.feed,
    chat: socketState.chat,
    gameOverState: socketState.gameOverState,
    ratingUpdate: socketState.ratingUpdate,
    notice: socketState.notice,
    clearNotice: socketState.clearNotice,
    sendChatMessage: socketState.sendChatMessage,
    rematchState: socketState.rematchState,
    requestRematch: socketState.requestRematch,
    declineRematch: socketState.declineRematch,
  }), [socketState]);

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
