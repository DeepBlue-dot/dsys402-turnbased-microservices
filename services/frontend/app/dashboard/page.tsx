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
import { StatusPill } from "@/components/dashboard/status-pill";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { LiveState } from "@/components/dashboard/live-state";
import { RecentMatches } from "@/components/dashboard/recent-matches";

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

      <DashboardStats stats={stats} winRate={winRate} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <LiveState
          connectionState={connectionState}
          livePlayer={livePlayer}
          liveOpponentUsername={liveOpponentUsername}
        />

        <RecentMatches history={history} usernames={usernames} />
      </div>
    </div>
  );
}
