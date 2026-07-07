/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  LogOut,
  Play,
  Radio,
  RefreshCcw,
  Swords,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { StatusPill } from "@/components/dashboard/status-pill";
import { GameHubMatch } from "@/components/game/game-hub-match";
import { GameHubQueue } from "@/components/game/game-hub-queue";
import { LiveFeed } from "@/components/game/live-feed";
import { historyApi, matchmakingApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type { CurrentPlayerState, MatchHistoryItem } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, logout, player, refreshUser, user } = useAuth();
  const {
    clearNotice,
    connectionState,
    feed,
    isConnected,
    liveGame,
    liveQueue,
    liveStatus,
    notice,
    sync,
  } = useGameSocket(!!user);
  const [queueIntent, setQueueIntent] = useState(false);
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

  const activeStatus = livePlayer?.status || "OFFLINE";
  const hasActiveGame = !!livePlayer?.game && activeStatus === "IN_GAME";
  const isQueued = activeStatus === "QUEUED";
  const stats = livePlayer?.stats || {
    wins: 0,
    losses: 0,
    draws: 0,
    rating: livePlayer?.rating || 1000,
  };
  const totalGames = stats.wins + stats.losses + stats.draws;
  const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;

  const loadHistory = useCallback(() => {
    if (!user) return;

    historyApi
      .mine({ page: 1, limit: 8 })
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("queue") === "1") {
      setQueueIntent(true);
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (isConnected) {
      void refreshUser();
    }
  }, [isConnected, refreshUser]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (hasActiveGame) {
      setQueueIntent(false);
    }
  }, [hasActiveGame]);

  async function handleLeaveQueue() {
    setActionError(null);
    try {
      await matchmakingApi.leave();
      setQueueIntent(false);
      await refreshUser();
      sync();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to leave queue.");
    }
  }

  const handleFindMatch = useCallback(() => {
    setActionError(null);
    setQueueIntent(true);
  }, []);

  const handleReturnToHub = useCallback(() => {
    loadHistory();
  }, [loadHistory]);

  const handleOpenHistory = useCallback(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading || !livePlayer || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="animate-pulse text-muted-foreground">Loading game hub...</p>
      </div>
    );
  }

  const shouldShowQueue = !hasActiveGame && (queueIntent || isQueued);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Swords className="h-7 w-7 text-primary" aria-hidden="true" />
              Game Hub
            </h1>
            <StatusPill status={activeStatus} />
            <span className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs",
              isConnected
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-muted bg-muted/40 text-muted-foreground",
            )}>
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              {connectionState}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.username}. Queue, play, rematch, and review from this one shell.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Sync
          </Button>
          {isQueued ? (
            <Button variant="outline" onClick={() => void handleLeaveQueue()}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Leave Queue
            </Button>
          ) : (
            <Button onClick={handleFindMatch} disabled={hasActiveGame} className="font-bold">
              <Play className="h-4 w-4" aria-hidden="true" />
              {hasActiveGame ? "Match Active" : "Find Match"}
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

      {hasActiveGame ? (
        <GameHubMatch
          onFindNextMatch={handleFindMatch}
          onOpenHistory={handleOpenHistory}
          onReturnToHub={handleReturnToHub}
        />
      ) : shouldShowQueue ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <GameHubQueue
            clearNotice={clearNotice}
            connectionState={connectionState}
            isConnected={isConnected}
            liveQueue={livePlayer.queue}
            notice={notice}
            onError={setActionError}
            onLeave={handleLeaveQueue}
            onQueued={refreshUser}
            shouldJoin={queueIntent}
            sync={sync}
          />
          <aside className="space-y-4">
            <DashboardStats stats={stats} winRate={winRate} />
            <LiveFeed feed={feed} />
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-5">
            <Card className="border-border/80 bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Trophy className="h-6 w-6 text-primary" aria-hidden="true" />
                  Ready Room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-muted-foreground">
                  You are idle and ready. Start matchmaking here, then stay in this shell when the board appears.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Rating</p>
                    <p className="mt-1 font-mono text-2xl font-bold">{stats.rating}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Record</p>
                    <p className="mt-1 font-mono text-lg font-bold">
                      {stats.wins}W {stats.losses}L {stats.draws}D
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Win Rate</p>
                    <p className="mt-1 font-mono text-2xl font-bold">{winRate}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={handleFindMatch} className="font-bold">
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Find Match
                  </Button>
                </div>
              </CardContent>
            </Card>
            <DashboardStats stats={stats} winRate={winRate} />
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
                  Live Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span>Status</span>
                  <span className="font-semibold text-foreground">{activeStatus.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span>Gateway</span>
                  <span className="font-mono text-foreground">{connectionState}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span>Recent matches</span>
                  <span className="font-mono text-foreground">{history.length}</span>
                </div>
              </CardContent>
            </Card>
            <LiveFeed feed={feed} />
          </aside>
        </div>
      )}
    </div>
  );
}
