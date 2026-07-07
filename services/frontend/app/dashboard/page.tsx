"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  LogOut,
  Play,
  Radio,
  RefreshCcw,
  Shield,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { historyApi, matchmakingApi, playerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type {
  CurrentPlayerState,
  MatchHistoryItem,
  PlayerStatus,
} from "@/lib/types";

function StatusPill({ status }: { status: PlayerStatus | string }) {
  const styles: Record<string, string> = {
    IDLE: "border-primary/30 bg-primary/10 text-primary",
    QUEUED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    IN_GAME: "border-green-400/30 bg-green-400/10 text-green-300",
    OFFLINE: "border-muted bg-muted/40 text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
        styles[status] || styles.OFFLINE,
      )}
    >
      {status === "IDLE" ? "online" : status.replace("_", " ")}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const prevStatusRef = useRef<PlayerStatus | null>(null);
  const { loading, logout, player, refreshUser, user } = useAuth();
  const {
    connectionState,
    isConnected,
    sync,
    liveStatus,
    liveQueue,
    liveGame,
  } = useGameSocket(!!user);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const livePlayer = useMemo<CurrentPlayerState | null>(() => {
    if (!player) return null;

    return {
      ...player,
      game: liveGame || player.game,
      queue: liveQueue || player.queue,
      status: liveStatus !== "OFFLINE" ? liveStatus : player.status,
    };
  }, [player, liveGame, liveQueue, liveStatus]);

  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [liveOpponentUsername, setLiveOpponentUsername] = useState<string>("Loading...");

  const liveOpponentId = useMemo(() => {
    if (!livePlayer?.game?.players || !user?.id) return null;
    return livePlayer.game.players.find((id) => id !== user.id) || null;
  }, [livePlayer, user]);

  useEffect(() => {
    if (!liveOpponentId) return;
    playerApi
      .publicProfile(liveOpponentId)
      .then((profile) => setLiveOpponentUsername(profile.username))
      .catch(() => setLiveOpponentUsername("unknown"));
  }, [liveOpponentId]);

  useEffect(() => {
    const opponentIds = Array.from(
      new Set(history.map((m) => m.opponentId).filter((id): id is string => !!id))
    );
    opponentIds.forEach((id) => {
      setUsernames((prev) => {
        if (prev[id]) return prev;
        playerApi
          .publicProfile(id)
          .then((profile) => {
            setUsernames((p) => ({ ...p, [id]: profile.username }));
          })
          .catch((err) => {
            console.error(`Failed to fetch profile for player ${id}:`, err);
          });
        return prev;
      });
    });
  }, [history]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = liveStatus;

    if (prevStatus && prevStatus !== "OFFLINE" && prevStatus !== "IN_GAME" && liveStatus === "IN_GAME") {
      router.push("/game");
    } else if (prevStatus && prevStatus !== "OFFLINE" && prevStatus !== "QUEUED" && liveStatus === "QUEUED") {
      router.push("/matchmaking");
    }
  }, [liveStatus, router]);

  useEffect(() => {
    if (isConnected) {
      void refreshUser();
    }
  }, [isConnected, refreshUser]);

  useEffect(() => {
    if (!user) return;

    historyApi
      .mine({ page: 1, limit: 5 })
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]));
  }, [user]);

  async function handleLeaveQueue() {
    setActionError(null);
    try {
      await matchmakingApi.leave();
      await refreshUser();
      sync();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to leave queue.");
    }
  }

  if (loading || !livePlayer || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  const stats = livePlayer.stats || {
    wins: 0,
    losses: 0,
    draws: 0,
    rating: livePlayer.rating || 1000,
  };
  const totalGames = stats.wins + stats.losses + stats.draws;
  const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
  const canResume = livePlayer.status === "IN_GAME" && livePlayer.game;
  const isQueued = livePlayer.status === "QUEUED";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
            <StatusPill status={livePlayer.status} />
          </div>
          <p className="text-muted-foreground">
            Welcome back, {user.username}. Gateway is {connectionState}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Sync
          </Button>
          {isQueued ? (
            <Button variant="outline" onClick={handleLeaveQueue}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Leave Queue
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => router.push(canResume ? "/game" : "/matchmaking")}
              className="font-bold"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {canResume ? "Resume Match" : "Find Match"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating</CardTitle>
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wins</CardTitle>
            <Trophy className="h-4 w-4 text-green-300" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{stats.wins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Losses</CardTitle>
            <XCircle className="h-4 w-4 text-red-300" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-300">{stats.losses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
              Live State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Socket</span>
              <span className="font-mono">{connectionState}</span>
            </div>
            {livePlayer.queue && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Queue Position</span>
                  <span className="font-mono">
                    {livePlayer.queue.position ?? "pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wait Time</span>
                  <span className="font-mono">{livePlayer.queue.waitTimeSeconds}s</span>
                </div>
              </>
            )}
            {livePlayer.game && livePlayer.game.status === "ACTIVE" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Match Type</span>
                  <span className="font-semibold text-xs">Classic Match</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Opponent</span>
                  <span className="font-semibold text-xs">{liveOpponentUsername}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Symbol</span>
                  <span className="font-mono">{livePlayer.game.mySymbol}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved matches yet. Finish a game and it will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((match) => (
                  <div
                    key={match.matchId}
                    className="flex items-center justify-between gap-4 rounded-md border border-border bg-card/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Classic Match
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(match.endedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm">
                        vs {match.opponentId ? (usernames[match.opponentId] || "Loading...") : "unknown"} · {match.turnCount} turns
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-bold",
                        match.result === "WIN" && "bg-green-400/10 text-green-300",
                        match.result === "LOSS" && "bg-red-400/10 text-red-300",
                        match.result === "DRAW" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {match.result}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
