/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Flag,
  Handshake,
  History,
  Loader2,
  MessageSquare,
  Play,
  Radio,
  RefreshCcw,
  Send,
  ShieldAlert,
  Swords,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { playerApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type {
  BoardCell,
  GameSymbol,
  PlayerStats,
  PublicPlayerInfo,
} from "@/lib/types";

const emptyBoard: BoardCell[] = Array(9).fill("") as BoardCell[];

function normalizeBoard(board?: BoardCell[]) {
  if (!board || board.length !== 9) return [...emptyBoard];
  return board.map((cell) => (cell === "X" || cell === "O" ? cell : "")) as BoardCell[];
}

function formatReason(reason?: string) {
  if (!reason) return "";
  return reason.replaceAll("_", " ").toLowerCase();
}

function shortId(id?: string) {
  return id ? id.slice(0, 8) : "unknown";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function formatStatus(status?: string) {
  if (!status) return "Offline";
  if (status === "IDLE") return "online";
  return status.replaceAll("_", " ").toLowerCase();
}

function statusClasses(status?: string) {
  if (status === "IN_GAME") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "IDLE") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "QUEUED") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-muted bg-muted/40 text-muted-foreground";
}

function formatRecord(stats?: PlayerStats | null) {
  if (!stats) return "0W 0L 0D";
  return `${stats.wins}W ${stats.losses}L ${stats.draws}D`;
}

function formatLastOnline(value?: string | null) {
  if (!value) return "No recent activity";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";

  return `Last seen ${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })}`;
}



function PlayerPanel({
  align = "left",
  label,
  name,
  playerId,
  rating,
  record,
  status,
  symbol,
  supporting,
}: {
  align?: "left" | "right";
  label: string;
  name: string;
  playerId?: string;
  rating: number;
  record: string;
  status: string;
  symbol: GameSymbol;
  supporting: string;
}) {
  return (
    <div className={cn(
      "rounded-md border border-border bg-card p-3",
      align === "right" && "text-right",
    )}>
      <div className={cn(
        "flex items-start gap-3",
        align === "right" && "flex-row-reverse",
      )}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 font-bold">
          {name === "Waiting for opponent" ? (
            <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : playerId ? (
            <Link href={`/users/${playerId}`} className="hover:text-primary transition-colors">
              {initials(name)}
            </Link>
          ) : (
            initials(name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          {playerId && name !== "Waiting for opponent" ? (
            <Link
              href={`/users/${playerId}`}
              className="mt-1 block truncate text-lg font-bold hover:text-primary hover:underline transition-colors"
            >
              {name}
            </Link>
          ) : (
            <p className="mt-1 truncate text-lg font-semibold">{name}</p>
          )}
          <div className={cn(
            "mt-2 flex flex-wrap gap-2",
            align === "right" && "justify-end",
          )}>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs capitalize",
              statusClasses(status),
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {formatStatus(status)}
            </span>
            <span className="rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
              {rating} Elo
            </span>
          </div>
        </div>
        <span className={cn(
          "text-3xl font-black",
          symbol === "X" ? "text-primary" : "text-accent",
        )}>
          {symbol}
        </span>
      </div>
      <div className={cn(
        "mt-3 grid gap-1 text-xs text-muted-foreground",
        align === "right" && "justify-items-end",
      )}>
        <span>{record}</span>
        <span>{supporting}</span>
      </div>
    </div>
  );
}

export default function GamePage() {
  const router = useRouter();
  const {
    connectionState,
    error: socketError,
    isConnected,
    send,
    sync,
    liveStatus,
    liveGame: game,
    feed,
    chat,
    gameOverState: gameOver,
    ratingUpdate,
    notice,
    sendChatMessage,
  } = useGameSocket(!!user);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatText, setChatText] = useState("");
  const [opponentInfo, setOpponentInfo] = useState<PublicPlayerInfo | null>(null);
  const opponentId = game?.opponentId ||
    game?.players.find((playerId) => playerId !== user?.id);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

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

  useEffect(() => {
    if (!opponentId) {
      setOpponentInfo(null);
      return;
    }

    let cancelled = false;

    playerApi.publicProfile(opponentId)
      .then((profile) => {
        if (!cancelled) {
          setOpponentInfo(profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpponentInfo(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [opponentId]);

  const board = normalizeBoard(game?.board);
  const opponentSymbol = useMemo<GameSymbol>(() => {
    return game?.mySymbol === "X" ? "O" : "X";
  }, [game?.mySymbol]);
  const isMyTurn = !!game && !!user && game.turn === user.id && !gameOver;
  const currentPlayerName = user?.username || player?.profile?.username || "You";
  const currentPlayerStats = player?.stats || null;
  const currentPlayerRating = currentPlayerStats?.rating || player?.rating || user?.rating || 1000;
  const opponentLabel = opponentInfo?.username || (opponentId ? "Opponent" : "Waiting for opponent");
  const opponentStatus = opponentInfo?.status || (game ? "IN_GAME" : "OFFLINE");
  const opponentRating = opponentInfo?.rating || opponentInfo?.stats?.rating || 1000;
  const chatRecipientId = opponentId;
  const canChat = !!game && !!chatRecipientId && isConnected && !gameOver;
  const turnLabel = game?.turn === user?.id
    ? "You"
    : game?.turn === opponentId
      ? opponentLabel
      : game?.turn
        ? "Opponent"
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

    send({
      type: "GAME_MOVE",
      payload: {
        matchId: game.matchId,
        move: { position },
      },
    });
  }

  function forfeit() {
    if (!game || gameOver) return;

    send({
      type: "GAME_FORFEIT",
      payload: {
        matchId: game.matchId,
      },
    });
  }

  function proposeDraw() {
    if (!game || gameOver) return;

    send({
      type: "GAME_DRAW_PROPOSE",
      payload: {
        matchId: game.matchId,
      },
    });
  }

  function confirmDraw() {
    if (!game || gameOver) return;

    send({
      type: "GAME_DRAW_CONFIRM",
      payload: {
        matchId: game.matchId,
      },
    });
  }

  function declineDraw() {
    if (!game || gameOver) return;

    send({
      type: "GAME_DRAW_DECLINE",
      payload: {
        matchId: game.matchId,
      },
    });
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = chatText.trim();
    if (!text) return;

    const sent = sendChatMessage(text);
    if (sent) {
      setChatText("");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="animate-pulse text-muted-foreground">Loading match...</p>
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
                Match {game ? shortId(game.matchId) : "None"}
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
            <Button variant="outline" onClick={forfeit} disabled={!game || !!gameOver}>
              <Flag className="h-4 w-4" aria-hidden="true" />
              Forfeit
            </Button>
            <Button
              variant="outline"
              onClick={proposeDraw}
              disabled={!game || !!gameOver || !isConnected || !!game.drawProposedBy}
            >
              <Handshake className="h-4 w-4" aria-hidden="true" />
              Propose Draw
            </Button>
          </div>
        </div>

        {game?.drawProposedBy && (
          <div className="flex flex-col gap-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {game.drawProposedBy === user?.id
                    ? "Draw offer pending"
                    : "Draw offered by opponent"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {game.drawProposedBy === user?.id
                    ? "Waiting for opponent response..."
                    : "Would you like to accept the draw?"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {game.drawProposedBy !== user?.id ? (
                <>
                  <Button size="sm" onClick={confirmDraw} className="bg-amber-600 hover:bg-amber-700 text-white">
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={declineDraw}>
                    Decline
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={declineDraw}>
                  Cancel Offer
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <PlayerPanel
            label="You"
            name={currentPlayerName}
            playerId={user?.id}
            rating={currentPlayerRating}
            record={formatRecord(currentPlayerStats)}
            status={liveStatus !== "OFFLINE" ? liveStatus : (player?.status || user.status)}
            symbol={game?.mySymbol || "X"}
            supporting={player?.profile?.bio || "Ready in this match"}
          />
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Turn timer</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono text-3xl font-bold">
              <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {countdown === null ? "--" : `${countdown}s`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Turn: {turnLabel}</p>
          </div>
          <PlayerPanel
            align="right"
            label="Opponent"
            name={opponentLabel}
            playerId={opponentId}
            rating={opponentRating}
            record={formatRecord(opponentInfo?.stats)}
            status={opponentStatus}
            symbol={opponentSymbol}
            supporting={opponentInfo?.bio || formatLastOnline(opponentInfo?.lastOnline)}
          />
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
              <h2 className="font-semibold">Match Chat</h2>
              <p className="text-sm text-muted-foreground">
                {chatRecipientId
                  ? `To ${opponentLabel} (${formatStatus(opponentStatus)})`
                  : "Waiting for opponent"}
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="mb-3 flex max-h-52 min-h-28 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {chat.length === 0 ? (
              <p className="m-auto text-center text-sm text-muted-foreground">
                No messages yet.
              </p>
            ) : (
              chat.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "max-w-[85%] rounded-md border px-3 py-2 text-sm",
                    item.from === "me" && "ml-auto border-primary/30 bg-primary/10",
                    item.from === "opponent" && "mr-auto border-border bg-card",
                    item.from === "system" && "mx-auto border-muted bg-muted/40 text-muted-foreground",
                  )}
                >
                  <p>{item.text}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
                    {item.from === "me" ? (
                      <Link href={`/users/${user?.id}`} className="hover:underline hover:text-primary transition-colors">You</Link>
                    ) : item.from === "opponent" && opponentId ? (
                      <Link href={`/users/${opponentId}`} className="hover:underline hover:text-primary transition-colors">{opponentLabel}</Link>
                    ) : (
                      "System"
                    )} · {item.at}
                    {item.status === "pending" ? " · sending" : ""}
                    {item.status === "failed" ? " · failed" : ""}
                  </p>
                </div>
              ))
            )}
          </div>

          <form className="flex gap-2" onSubmit={sendChat}>
            <Input
              aria-label="Match chat message"
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder={canChat ? "Message opponent..." : "Chat unavailable"}
              maxLength={240}
              disabled={!canChat}
            />
            <Button type="submit" size="sm" disabled={!canChat || !chatText.trim()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>

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

      </aside>

      {/* Premium Glassmorphic Overlay Popup for No Game or Game Over states */}
      {(!game || gameOver) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="relative w-full max-w-md overflow-hidden border border-border/80 bg-card/60 backdrop-blur-xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            {/* Ambient Background Glow */}
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-accent/10 blur-2xl pointer-events-none" />

            <CardContent className="space-y-6 pt-4 flex flex-col items-center">
              {!game ? (
                // Case: No Active Game
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/80 bg-muted/40 text-muted-foreground shadow-inner">
                    <Swords className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-foreground">No Active Match</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect to the gateway or enter matchmaking to start a round.
                    </p>
                  </div>
                  {socketError && (
                    <div className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                      {socketError}
                    </div>
                  )}
                  <div className="w-full grid gap-2">
                    <Button onClick={() => router.push("/matchmaking")} className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold tracking-wide shadow-md shadow-primary/20 transition-all duration-200">
                      <Play className="mr-2 h-4 w-4 fill-current" aria-hidden="true" />
                      Find Match
                    </Button>
                    <Button variant="outline" onClick={() => sync()} disabled={!isConnected} className="w-full border-border/80 bg-muted/30 hover:bg-muted/50 font-bold transition-all duration-200">
                      <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                      Sync State
                    </Button>
                    <Button variant="ghost" onClick={() => router.push("/dashboard")} className="w-full text-muted-foreground hover:text-foreground font-bold transition-all duration-200">
                      Go to Dashboard
                    </Button>
                  </div>
                </>
              ) : (
                // Case: Game Over
                <>
                  <div className="mx-auto animate-in zoom-in duration-300">
                    {gameOver.result === "WIN" ? (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10 animate-bounce">
                        <span className="text-4xl font-black">{game.mySymbol}</span>
                      </div>
                    ) : gameOver.result === "LOSS" ? (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30 text-destructive shadow-lg shadow-destructive/10">
                        <span className="text-4xl font-black">{opponentSymbol}</span>
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
                        <Handshake className="h-10 w-10 text-amber-400" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 select-none">
                      Match Complete
                    </p>
                    <h2 className={cn(
                      "text-4xl font-black tracking-tighter",
                      gameOver.result === "WIN" && "text-emerald-400 drop-shadow-[0_2px_10px_rgba(16,185,129,0.15)]",
                      gameOver.result === "LOSS" && "text-destructive drop-shadow-[0_2px_10px_rgba(239,68,68,0.15)]",
                      gameOver.result === "DRAW" && "text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.15)]"
                    )}>
                      {gameOver.result}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ended by {formatReason(gameOver.reason) || "completion"}.
                    </p>
                  </div>

                  {/* Rating Update Display */}
                  <div className="w-full py-4 px-6 rounded-2xl bg-muted/30 border border-border/80 shadow-inner flex flex-col items-center justify-center gap-1">
                    <p className="text-xs text-muted-foreground font-semibold">Rating Update</p>
                    {ratingUpdate ? (
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base text-muted-foreground/80 select-none">
                          {ratingUpdate.newRating - ratingUpdate.ratingChange}
                        </span>
                        <span className="text-xs text-muted-foreground/40">→</span>
                        <span className="font-mono text-lg font-black text-foreground">
                          {ratingUpdate.newRating}
                        </span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold font-mono shadow-sm",
                          ratingUpdate.ratingChange > 0 && "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
                          ratingUpdate.ratingChange < 0 && "bg-destructive/10 border border-destructive/20 text-destructive",
                          ratingUpdate.ratingChange === 0 && "bg-muted border border-border text-muted-foreground"
                        )}>
                          {ratingUpdate.ratingChange >= 0 ? "+" : ""}{ratingUpdate.ratingChange}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground select-none animate-pulse">
                          Calculating rating change...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full grid gap-2">
                    <Button onClick={() => router.push("/matchmaking")} className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold tracking-wide shadow-md shadow-primary/20 transition-all duration-200">
                      Next Match
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/history/${game.matchId}`)} className="w-full border-border/80 bg-muted/30 hover:bg-muted/50 font-bold transition-all duration-200">
                      <History className="mr-2 h-4 w-4" aria-hidden="true" />
                      View Match Details
                    </Button>
                    <Button variant="ghost" onClick={() => router.push("/dashboard")} className="w-full text-muted-foreground hover:text-foreground font-bold transition-all duration-200">
                      Back to Dashboard
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
