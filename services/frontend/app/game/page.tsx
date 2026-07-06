/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flag,
  Loader2,
  Radio,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type {
  ActiveGameState,
  BoardCell,
  GameOverMessage,
  GameSocketMessage,
  GameSymbol,
} from "@/lib/types";

const emptyBoard: BoardCell[] = Array(9).fill("") as BoardCell[];

function normalizeBoard(board?: BoardCell[]) {
  if (!board || board.length !== 9) return emptyBoard;
  return board.map((cell) => (cell === "X" || cell === "O" ? cell : "")) as BoardCell[];
}

function gameFromSync(message: GameSocketMessage | null) {
  if (
    (message?.type === "CONNECT_SYNC" || message?.type === "SYNC_RESPONSE") &&
    message.data.game
  ) {
    return message.data.game;
  }

  return null;
}

function formatReason(reason?: string) {
  if (!reason) return "";
  return reason.replaceAll("_", " ").toLowerCase();
}

export default function GamePage() {
  const router = useRouter();
  const { loading, player, refreshUser, user } = useAuth();
  const { connectionState, isConnected, lastMessage, send, sync } = useGameSocket(
    !!user,
  );
  const [game, setGame] = useState<ActiveGameState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverMessage["data"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (player?.game) {
      setGame({
        ...player.game,
        board: normalizeBoard(player.game.board),
      });
    }
  }, [player?.game]);

  useEffect(() => {
    if (!lastMessage) return;

    const syncedGame = gameFromSync(lastMessage);
    if (syncedGame) {
      setGame({
        ...syncedGame,
        board: normalizeBoard(syncedGame.board),
      });
      setGameOver(null);
      setNotice(null);
      return;
    }

    if (lastMessage.type === "MATCH_CREATED") {
      setGame((current) => ({
        matchId: lastMessage.data.matchId,
        players: current?.players || [],
        board: current?.board || emptyBoard,
        turn: current?.turn || "",
        mySymbol: current?.mySymbol || "X",
        status: "ACTIVE",
        expiresAt: current?.expiresAt || Date.now(),
        opponentId: lastMessage.data.opponentId,
      }));
      return;
    }

    if (lastMessage.type === "GAME_STARTED") {
      setGame((current) => ({
        matchId: lastMessage.data.matchId,
        players: current?.players || [lastMessage.data.recipientId, lastMessage.data.opponentId],
        board: current?.board || emptyBoard,
        turn: lastMessage.data.turn,
        mySymbol: lastMessage.data.mySymbol,
        status: "ACTIVE",
        expiresAt: lastMessage.data.expiresAt,
        opponentId: lastMessage.data.opponentId,
      }));
      setGameOver(null);
      setNotice(null);
      return;
    }

    if (lastMessage.type === "GAME_TURN") {
      setGame((current) => ({
        matchId: lastMessage.data.matchId,
        players: current?.players || [],
        board: normalizeBoard(lastMessage.data.board),
        turn: lastMessage.data.nextTurn,
        mySymbol: current?.mySymbol || "X",
        status: "ACTIVE",
        expiresAt: lastMessage.data.expiresAt,
        opponentId: current?.opponentId,
      }));
      setNotice(null);
      return;
    }

    if (lastMessage.type === "INVALID_MOVE") {
      setNotice(formatReason(lastMessage.data.reason) || "Invalid move.");
      return;
    }

    if (lastMessage.type === "GAME_OVER") {
      setGameOver(lastMessage.data);
      setGame((current) =>
        current
          ? {
              ...current,
              board: normalizeBoard(lastMessage.data.finalBoard),
              status: "ENDED",
            }
          : null,
      );
      void refreshUser();
      return;
    }

    if (lastMessage.type === "ERROR" || lastMessage.type === "MATCH_ERROR") {
      const data = lastMessage.data;
      setNotice(
        typeof data === "string"
          ? data
          : data?.reason || lastMessage.message || "Gateway error.",
      );
    }
  }, [lastMessage, refreshUser]);

  useEffect(() => {
    if (!game?.expiresAt || gameOver) {
      setCountdown(null);
      return;
    }

    const update = () => {
      setCountdown(Math.max(0, Math.ceil((game.expiresAt - Date.now()) / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [game?.expiresAt, gameOver]);

  const board = normalizeBoard(game?.board);
  const opponentSymbol = useMemo<GameSymbol>(() => {
    return game?.mySymbol === "X" ? "O" : "X";
  }, [game?.mySymbol]);
  const isMyTurn = !!game && !!user && game.turn === user.id && !gameOver;
  const statusText = gameOver
    ? `Game over: ${gameOver.result.toLowerCase()}`
    : isMyTurn
      ? "Your turn"
      : game
        ? "Waiting for opponent"
        : "No active match";

  function makeMove(position: number) {
    if (!game || !isMyTurn || board[position] || gameOver) return;

    const sent = send({
      type: "GAME_MOVE",
      payload: {
        matchId: game.matchId,
        move: { position },
      },
    });

    if (!sent) {
      setNotice("Move was not sent because the socket is disconnected.");
    }
  }

  function forfeit() {
    if (!game) return;

    const sent = send({
      type: "GAME_FORFEIT",
      payload: {
        matchId: game.matchId,
      },
    });

    if (!sent) {
      setNotice("Forfeit was not sent because the socket is disconnected.");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="animate-pulse text-muted-foreground">Loading match...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-5 pt-6">
            <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold">No Active Match</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect to the gateway or enter matchmaking to start a round.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Sync
              </Button>
              <Button onClick={() => router.push("/matchmaking")}>Find Match</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-2xl flex-col justify-center gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio
              className={cn("h-4 w-4", isConnected ? "text-primary" : "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {connectionState}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tic Tac Toe</h1>
          <p className="text-muted-foreground">{statusText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Button>
          <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Sync
          </Button>
          <Button variant="outline" onClick={forfeit} disabled={!!gameOver}>
            <Flag className="h-4 w-4" aria-hidden="true" />
            Forfeit
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs uppercase text-muted-foreground">You</p>
          <p className="text-2xl font-bold text-primary">{game.mySymbol}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3 text-center">
          <p className="text-xs uppercase text-muted-foreground">Timer</p>
          <p className="font-mono text-2xl font-bold">
            {countdown === null ? "--" : `${countdown}s`}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3 text-right">
          <p className="text-xs uppercase text-muted-foreground">Opponent</p>
          <p className="text-2xl font-bold text-accent">{opponentSymbol}</p>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}

      <div className="grid aspect-square w-full grid-cols-3 gap-3">
        {board.map((cell, index) => {
          const disabled = !isMyTurn || !!cell || !!gameOver || !isConnected;

          return (
            <button
              key={index}
              aria-label={`Cell ${index + 1}${cell ? ` occupied by ${cell}` : ""}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border border-border bg-card text-5xl font-black transition sm:text-7xl",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !disabled && "hover:border-primary hover:bg-primary/10",
                disabled && "cursor-not-allowed",
                cell === "X" && "text-primary",
                cell === "O" && "text-accent",
              )}
              disabled={disabled}
              onClick={() => makeMove(index)}
            >
              {cell}
            </button>
          );
        })}
      </div>

      <div className="truncate rounded-md border border-border bg-muted/30 px-4 py-3 font-mono text-xs text-muted-foreground">
        Match {game.matchId}
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur">
          <Card className="w-full max-w-md text-center">
            <CardContent className="space-y-5 pt-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
                {gameOver.result === "WIN" ? (
                  <span className="text-3xl font-black text-primary">{game.mySymbol}</span>
                ) : gameOver.result === "LOSS" ? (
                  <span className="text-3xl font-black text-accent">{opponentSymbol}</span>
                ) : (
                  <Loader2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-muted-foreground">
                  Match Complete
                </p>
                <h2 className="text-3xl font-bold">{gameOver.result}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ended by {formatReason(gameOver.reason)}.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
                <Button onClick={() => router.push("/matchmaking")}>
                  Next Match
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
