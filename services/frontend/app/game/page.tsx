/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  Flag,
  History,
  Loader2,
  Play,
  Radio,
  RefreshCcw,
  ShieldAlert,
  Swords,
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

type FeedItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  symbol?: GameSymbol;
};

function normalizeBoard(board?: BoardCell[]) {
  if (!board || board.length !== 9) return [...emptyBoard];
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

function shortId(id?: string) {
  return id ? id.slice(0, 8) : "unknown";
}

function cellName(position: number) {
  const row = Math.floor(position / 3) + 1;
  const column = (position % 3) + 1;
  return `row ${row}, column ${column}`;
}

function findNewMove(previous: BoardCell[], next: BoardCell[]) {
  for (let index = 0; index < next.length; index += 1) {
    if (!previous[index] && next[index]) {
      return {
        position: index,
        symbol: next[index] as GameSymbol,
      };
    }
  }

  return null;
}

export default function GamePage() {
  const router = useRouter();
  const { loading, player, refreshUser, user } = useAuth();
  const {
    connectionState,
    error: socketError,
    isConnected,
    lastMessage,
    send,
    sync,
  } = useGameSocket(!!user);
  const [game, setGame] = useState<ActiveGameState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverMessage["data"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const boardRef = useRef<{ matchId: string | null; board: BoardCell[] }>({
    matchId: null,
    board: [...emptyBoard],
  });

  const recordEvent = useCallback((item: Omit<FeedItem, "id" | "at">) => {
    setFeed((current) => [
      {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
      ...current,
    ].slice(0, 8));
  }, []);

  const commitGame = useCallback((
    nextGame: ActiveGameState,
    options: {
      source: "profile" | "sync" | "match" | "turn" | "over";
      recordMove?: boolean;
      eventTitle?: string;
      eventDetail?: string;
    },
  ) => {
    const normalizedGame = {
      ...nextGame,
      board: normalizeBoard(nextGame.board),
    };
    const previous = boardRef.current;
    const isSameMatch = previous.matchId === normalizedGame.matchId;

    if (!isSameMatch) {
      setFeed([]);
    }

    if (options.recordMove && isSameMatch) {
      const move = findNewMove(previous.board, normalizedGame.board);

      if (move) {
        recordEvent({
          title: `${move.symbol} placed a mark`,
          detail: `Cell ${move.position + 1}, ${cellName(move.position)}`,
          symbol: move.symbol,
        });
      }
    }

    if (options.eventTitle) {
      recordEvent({
        title: options.eventTitle,
        detail: options.eventDetail || `Match ${shortId(normalizedGame.matchId)}`,
      });
    }

    boardRef.current = {
      matchId: normalizedGame.matchId,
      board: normalizedGame.board,
    };
    setGame(normalizedGame);
  }, [recordEvent]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (player?.game) {
      commitGame(player.game, { source: "profile" });
    }
  }, [commitGame, player?.game]);

  useEffect(() => {
    if (!lastMessage) return;

    const syncedGame = gameFromSync(lastMessage);
    if (syncedGame) {
      commitGame(syncedGame, {
        source: "sync",
        recordMove: boardRef.current.matchId === syncedGame.matchId,
      });
      setGameOver(null);
      setNotice(null);
      return;
    }

    if (lastMessage.type === "MATCH_CREATED") {
      const matchGame: ActiveGameState = {
        matchId: lastMessage.data.matchId,
        players: game?.players || [],
        board: game?.board || [...emptyBoard],
        turn: game?.turn || "",
        mySymbol: game?.mySymbol || "X",
        status: "ACTIVE",
        expiresAt: game?.expiresAt || Date.now(),
        opponentId: lastMessage.data.opponentId,
      };

      commitGame(matchGame, {
        source: "match",
        eventTitle: "Match allocated",
        eventDetail: lastMessage.data.opponentId
          ? `Opponent ${shortId(lastMessage.data.opponentId)} found`
          : "Opponent found",
      });
      return;
    }

    if (lastMessage.type === "GAME_STARTED") {
      commitGame({
        matchId: lastMessage.data.matchId,
        players: game?.players || [lastMessage.data.recipientId, lastMessage.data.opponentId],
        board: game?.board || [...emptyBoard],
        turn: lastMessage.data.turn,
        mySymbol: lastMessage.data.mySymbol,
        status: "ACTIVE",
        expiresAt: lastMessage.data.expiresAt,
        opponentId: lastMessage.data.opponentId,
      }, {
        source: "match",
        eventTitle: "Game started",
        eventDetail: `You are ${lastMessage.data.mySymbol}`,
      });
      setGameOver(null);
      setNotice(null);
      return;
    }

    if (lastMessage.type === "GAME_TURN") {
      commitGame({
        matchId: lastMessage.data.matchId,
        players: game?.players || [],
        board: normalizeBoard(lastMessage.data.board),
        turn: lastMessage.data.nextTurn,
        mySymbol: game?.mySymbol || "X",
        status: "ACTIVE",
        expiresAt: lastMessage.data.expiresAt,
        opponentId: game?.opponentId,
      }, {
        source: "turn",
        recordMove: true,
      });
      setNotice(null);
      return;
    }

    if (lastMessage.type === "INVALID_MOVE") {
      setNotice(formatReason(lastMessage.data.reason) || "Invalid move.");
      recordEvent({
        title: "Move rejected",
        detail: formatReason(lastMessage.data.reason) || "Invalid move",
      });
      return;
    }

    if (lastMessage.type === "GAME_OVER") {
      setGameOver(lastMessage.data);
      if (game) {
        commitGame({
          ...game,
          board: normalizeBoard(lastMessage.data.finalBoard),
          status: "ENDED",
        }, {
          source: "over",
          recordMove: true,
          eventTitle: "Game over",
          eventDetail: `${lastMessage.data.result.toLowerCase()} by ${formatReason(lastMessage.data.reason) || "completion"}`,
        });
      }
      void refreshUser();
      return;
    }

    if (
      lastMessage.type === "ERROR" ||
      lastMessage.type === "MATCH_ERROR" ||
      lastMessage.type === "DISCONNECTED"
    ) {
      const data = lastMessage.data;
      setNotice(
        typeof data === "string"
          ? data
          : data?.reason || lastMessage.message || "Gateway error.",
      );
    }
  }, [commitGame, game, lastMessage, recordEvent, refreshUser]);

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
  const opponentLabel = game?.opponentId
    ? `Player ${shortId(game.opponentId)}`
    : "Opponent";
  const turnLabel = game?.turn === user?.id
    ? "You"
    : game?.turn
      ? `Player ${shortId(game.turn)}`
      : "Waiting";
  const statusText = gameOver
    ? `Game over: ${gameOver.result.toLowerCase()}`
    : isMyTurn
      ? "Your turn"
      : game
        ? "Waiting for opponent"
        : "No active match";
  const actionHint = !isConnected
    ? "Reconnect to send moves."
    : gameOver
      ? "The match has ended."
      : isMyTurn
        ? "Choose an empty cell."
        : "Opponent is thinking.";

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
    if (!game || gameOver) return;

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
            {socketError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {socketError}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Sync
              </Button>
              <Button onClick={() => router.push("/matchmaking")}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Find Match
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-w-0 flex-col justify-center gap-5">
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs",
                isConnected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-muted bg-muted/40 text-muted-foreground",
              )}>
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                {connectionState}
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                <Swords className="h-3.5 w-3.5" aria-hidden="true" />
                Match {shortId(game.matchId)}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Tic Tac Toe</h1>
              <p className="text-muted-foreground">{statusText}. {actionHint}</p>
            </div>
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
            <p className="mt-1 text-lg font-semibold">{user.username}</p>
            <p className="text-3xl font-black text-primary">{game.mySymbol}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Turn timer</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono text-3xl font-bold">
              <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {countdown === null ? "--" : `${countdown}s`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Turn: {turnLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-right">
            <p className="text-xs uppercase text-muted-foreground">Opponent</p>
            <p className="mt-1 text-lg font-semibold">{opponentLabel}</p>
            <p className="text-3xl font-black text-accent">{opponentSymbol}</p>
          </div>
        </div>

        {(notice || socketError) && (
          <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">
            {notice || socketError}
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
                {cell || <span className="text-base font-medium text-muted-foreground/30">{index + 1}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4 lg:justify-center">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Live Feed</h2>
              <p className="text-sm text-muted-foreground">Observed in this session</p>
            </div>
            <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {feed.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No live moves yet. Synced board state is shown without replaying unknown history.
            </div>
          ) : (
            <ol className="space-y-3">
              {feed.map((item) => (
                <li key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                    {item.symbol && (
                      <span className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-black",
                        item.symbol === "X"
                          ? "border-primary/30 text-primary"
                          : "border-accent/30 text-accent",
                      )}>
                        {item.symbol}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{item.at}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {gameOver && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm uppercase text-muted-foreground">Match complete</p>
            <h2 className="mt-1 text-3xl font-bold">{gameOver.result}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ended by {formatReason(gameOver.reason) || "completion"}.
            </p>
            <div className="mt-4 grid gap-2">
              <Button onClick={() => router.push("/matchmaking")}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Find Another Match
              </Button>
              <Button variant="outline" onClick={() => router.push(`/history/${game.matchId}`)}>
                <History className="h-4 w-4" aria-hidden="true" />
                View Match Detail
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                Dashboard
              </Button>
            </div>
          </div>
        )}
      </aside>

      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur lg:hidden">
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
                <p className="text-sm uppercase text-muted-foreground">Match Complete</p>
                <h2 className="text-3xl font-bold">{gameOver.result}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ended by {formatReason(gameOver.reason) || "completion"}.
                </p>
              </div>
              <div className="grid gap-2">
                <Button onClick={() => router.push("/matchmaking")}>
                  Next Match
                </Button>
                <Button variant="outline" onClick={() => router.push(`/history/${game.matchId}`)}>
                  View Details
                </Button>
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
