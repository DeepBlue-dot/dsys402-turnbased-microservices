"use client";

import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  // Mock Data
  const stats = {
    wins: 12,
    losses: 5,
    rank: "Silver II",
    winRate: "70%"
  };

  const history = [
    { id: 1, opponent: "ShadowSlayer", result: "WIN", date: "2 mins ago", score: "Score: 1500" },
    { id: 2, opponent: "NoobMaster69", result: "WIN", date: "1 hour ago", score: "Score: 1450" },
    { id: 3, opponent: "ProGamer_X", result: "LOSS", date: "Yesterday", score: "Score: 1200" },
    { id: 4, opponent: "TheLegend27", result: "LOSS", date: "2 days ago", score: "Score: 1100" },
    { id: 5, opponent: "Bot_001", result: "WIN", date: "3 days ago", score: "Score: 1300" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-muted-foreground">Welcome back, {user.username}</p>
        </div>
        <Button size="lg" onClick={() => router.push("/matchmaking")} className="font-bold">
          FIND MATCH
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rank}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.wins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Losses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{stats.losses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.winRate}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Recent Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-4 border border-white/20 rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">vs {match.opponent}</span>
                  <span className="text-sm text-muted-foreground">{match.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">{match.score}</span>
                  <span
                    className={`font-bold px-2 py-1 rounded text-xs ${match.result === "WIN"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                  >
                    {match.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
