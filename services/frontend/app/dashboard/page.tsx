"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { historyApi, playerApi, matchmakingApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type {
  CurrentPlayerState,
  MatchHistoryItem,
  PlayerSearchItem,
} from "@/lib/types";
import { PlayerHeroCard } from "@/components/dashboard/player-hero-card";
import { LeaderboardPeek } from "@/components/dashboard/leaderboard-peek";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { LiveState } from "@/components/dashboard/live-state";
import { RecentMatches } from "@/components/dashboard/recent-matches";
import { MatchmakingView } from "@/components/matchmaking/matchmaking-view";
import { GameView } from "@/components/game/game-view";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, logout, player, refreshUser, user } = useAuth();
  const {
    connectionState,
    isConnected,
    sync,
    liveStatus,
    liveQueue,
    liveGame,
    gameOverState,
  } = useGameSocket(!!user);
  
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerSearchItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"hub" | "game">("hub");

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
    if (isConnected) {
      void refreshUser();
    }
  }, [isConnected, refreshUser]);

  const refreshDashboardData = useMemo(() => {
    return async () => {
      if (!user) return;

      try {
        const [historyRes, leaderboardRes] = await Promise.all([
          historyApi.mine({ page: 1, limit: 10 }),
          playerApi.search({ page: 1, limit: 5 }),
        ]);

        setHistory(historyRes.data);
        setLeaderboard(leaderboardRes.data);
      } catch (err) {
        console.error("Failed to refresh dashboard data:", err);
        setHistory([]);
        setLeaderboard([]);
      }
    };
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDashboardData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshDashboardData]);

  useEffect(() => {
    if (!gameOverState) return;

    const timer = window.setTimeout(() => {
      void refreshDashboardData();
      void refreshUser();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [gameOverState, refreshDashboardData, refreshUser]);

  async function handleFindMatch() {
    setActionError(null);
    try {
      await matchmakingApi.join();
      await refreshUser();
      sync();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to start matchmaking.");
    }
  }

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

  // Compute current win/loss streak from history
  const { streak, streakType } = useMemo(() => {
    if (history.length === 0) return { streak: 0, streakType: "none" as const };
    const firstResult = history[0].result;
    if (firstResult === "DRAW") return { streak: 0, streakType: "none" as const };

    let count = 0;
    for (const match of history) {
      if (match.result === firstResult) {
        count++;
      } else {
        break;
      }
    }
    return {
      streak: count,
      streakType: firstResult === "WIN" ? ("win" as const) : ("loss" as const),
    };
  }, [history]);

  if (loading || !livePlayer || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading game hub...</p>
      </div>
    );
  }

  // --- CONDITIONAL STATE RENDER ---
  const status = livePlayer.status || "IDLE";

  if (status === "QUEUED") {
    return (
      <div className="max-w-6xl mx-auto">
        <MatchmakingView />
      </div>
    );
  }

  const hasLiveMatch = status === "IN_GAME" || (!!liveGame && liveGame.status !== "ENDED");
  const shouldShowGameView = hasLiveMatch || (viewMode === "game" && !!gameOverState);

  if (shouldShowGameView) {
    return (
      <div className="max-w-6xl mx-auto">
        <GameView onBackToHub={() => setViewMode("hub")} />
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Player Identity Hero Card */}
      <PlayerHeroCard
        user={user}
        livePlayer={livePlayer}
        streak={streak}
        streakType={streakType}
      />

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Progression & Stats Grid */}
      <DashboardStats stats={stats} winRate={winRate} history={history} />

      {/* Primary Interaction Split Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Left Column: Action Zone / Gateway */}
        <div className="space-y-6">
          <LiveState
            connectionState={connectionState}
            isConnected={isConnected}
            livePlayer={livePlayer}
            liveOpponentUsername={liveOpponentUsername}
            sync={sync}
            onFindMatch={handleFindMatch}
            handleLeaveQueue={handleLeaveQueue}
            logout={() => void logout()}
          />
        </div>

        {/* Right Column: Social Leaderboard & Match History */}
        <div className="space-y-6">
          <LeaderboardPeek players={leaderboard} currentUserId={user.id} />
          <RecentMatches history={history} usernames={usernames} />
        </div>
      </div>
    </div>
  );
}
