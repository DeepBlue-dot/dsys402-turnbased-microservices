"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Flag,
  Handshake,
  Radio,
  RefreshCcw,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchmakingApi, playerApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type {
  BoardCell,
  GameSymbol,
  PlayerStats,
  PublicPlayerInfo,
} from "@/lib/types";

import { PlayerPanel } from "@/components/game/player-panel";
import { GameBoard } from "@/components/game/game-board";
import { MatchChat } from "@/components/game/match-chat";
import { LiveFeed } from "@/components/game/live-feed";
import { GameOverlay } from "@/components/game/game-overlay";

const emptyBoard: BoardCell[] = Array(9).fill("") as BoardCell[];

function normalizeBoard(board?: BoardCell[]) {
  if (!board || board.length !== 9) return [...emptyBoard];
  return board.map((cell) => (cell === "X" || cell === "O" ? cell : "")) as BoardCell[];
}

function shortId(id?: string) {
  return id ? id.slice(0, 8) : "unknown";
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

export function GameView({ onBackToHub }: { onBackToHub?: () => void }) {
  const router = useRouter();
  const { player, user } = useAuth();
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
    rematchState,
    requestRematch,
    declineRematch,
  } = useGameSocket();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatText, setChatText] = useState("");
  const [activityTab, setActivityTab] = useState<"chat" | "feed">("chat");
  const [opponentInfo, setOpponentInfo] = useState<PublicPlayerInfo | null>(null);
  
  const opponentId = game?.opponentId ||
    game?.players.find((playerId) => playerId !== user?.id);

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

  function handleFindNextMatch() {
    matchmakingApi
      .join()
      .then(() => {
        sync();
      })
      .catch((err) => {
        console.error("Failed to join next match:", err);
      });
  }

  function handleOpenHistory() {
    if (game?.matchId) {
      router.push(`/history/${game.matchId}`);
    }
  }

  function handleReturnToHub() {
    onBackToHub?.();
    sync();
  }

  if (!user) return null;

  return (
    <div className="mx-auto grid min-h-[calc(100vh-10rem)] w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px] animate-in fade-in duration-300">
      <section className="flex min-w-0 flex-col justify-center gap-5">
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs font-semibold",
                isConnected
                  ? "border-primary/30 bg-primary/10 text-primary animate-pulse"
                  : "border-muted bg-muted/40 text-muted-foreground",
              )}>
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                {connectionState}
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-semibold text-muted-foreground">
                <Swords className="h-3.5 w-3.5" aria-hidden="true" />
                Match {game ? shortId(game.matchId) : "None"}
              </span>
            </div>

          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={forfeit}
              disabled={!game || !!gameOver}
              className="rounded-xl border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 font-bold text-xs"
            >
              <Flag className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Forfeit
            </Button>
            <Button
              variant="outline"
              onClick={proposeDraw}
              disabled={!game || !!gameOver || !isConnected || !!game.drawProposedBy}
              className="rounded-xl font-bold text-xs"
            >
              <Handshake className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Draw
            </Button>
            <Button variant="outline" onClick={() => sync()} disabled={!isConnected} className="rounded-xl font-bold text-xs">
              <RefreshCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Sync
            </Button>
          </div>
        </div>

        {game?.drawProposedBy && (
          <div className="flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between animate-pulse">
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
                  <Button size="sm" onClick={confirmDraw} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg">
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={declineDraw} className="rounded-lg font-bold text-xs">
                    Decline
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={declineDraw} className="rounded-lg font-bold text-xs">
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
            avatarUrl={player?.profile?.avatarUrl}
            isActive={!!game && !gameOver && isMyTurn}
          />
          <div className="rounded-xl border border-border bg-card/45 p-3 text-center backdrop-blur-xl shadow-md flex flex-col justify-center items-center">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Turn timer</p>
            <p className="flex items-center justify-center gap-2 font-mono text-3xl font-black text-foreground">
              <Clock3 className="h-5 w-5 text-muted-foreground animate-pulse" aria-hidden="true" />
              {countdown === null ? "--" : `${countdown}s`}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground font-semibold">Turn: {turnLabel}</p>
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
            avatarUrl={opponentInfo?.avatarUrl}
            isActive={!!game && !gameOver && !isMyTurn && !!game.turn && game.turn === opponentId}
          />
        </div>

        {(notice || socketError) && (
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs text-amber-200">
            {notice || socketError}
          </div>
        )}

        <GameBoard
          board={board}
          isMyTurn={isMyTurn}
          gameOver={gameOver}
          isConnected={isConnected}
          onMakeMove={makeMove}
        />
      </section>

      <aside className="flex min-w-0 flex-col gap-4 lg:justify-center">
        <div className="flex min-h-[34rem] flex-col rounded-2xl border border-border/20 bg-card/40 p-2.5 shadow-sm backdrop-blur-xl lg:min-w-[380px]">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/35 p-1">
            <button
              type="button"
              onClick={() => setActivityTab("chat")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                activityTab === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              Match Chat
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("feed")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                activityTab === "feed"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              Live Feed
            </button>
          </div>

          {activityTab === "chat" ? (
            <MatchChat
              chat={chat}
              chatText={chatText}
              setChatText={setChatText}
              canChat={canChat}
              opponentLabel={opponentLabel}
              opponentStatus={opponentStatus}
              opponentId={opponentId}
              userId={user?.id}
              onSendChat={sendChat}
            />
          ) : (
            <LiveFeed feed={feed} />
          )}
        </div>
      </aside>

      {(!game || gameOver) && (
        <GameOverlay
          game={game}
          gameOver={gameOver}
          socketError={socketError}
          isConnected={isConnected}
          sync={sync}
          ratingUpdate={ratingUpdate}
          rematchState={rematchState}
          requestRematch={requestRematch}
          declineRematch={declineRematch}
          user={user}
          onFindNextMatch={handleFindNextMatch}
          onOpenHistory={handleOpenHistory}
          onReturnToHub={handleReturnToHub}
        />
      )}
    </div>
  );
}
