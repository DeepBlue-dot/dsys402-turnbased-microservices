"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, Clock, Compass, History, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MatchHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RecentMatchesProps {
  history: MatchHistoryItem[];
  usernames: Record<string, string>;
}

export function RecentMatches({ history, usernames }: RecentMatchesProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");

  const filteredHistory = history.filter((match) => {
    if (filter === "ALL") return true;
    return match.result === filter;
  });

  const getResultStyle = (result: string) => {
    switch (result) {
      case "WIN":
        return {
          border: "border-l-4 border-l-emerald-500 bg-emerald-500/[0.03] hover:border-emerald-400 hover:shadow-emerald-500/5",
          badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          text: "text-emerald-400",
        };
      case "LOSS":
        return {
          border: "border-l-4 border-l-destructive/40 bg-destructive/[0.02] hover:border-destructive/60 hover:shadow-destructive/5",
          badge: "text-destructive bg-destructive/10 border-destructive/20",
          text: "text-destructive",
        };
      default:
        return {
          border: "border-l-4 border-l-amber-500 bg-amber-500/[0.02] hover:border-amber-400 hover:shadow-amber-500/5",
          badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          text: "text-amber-400",
        };
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "0s";
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-lg space-y-4">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Recent Matches
        </h3>

        {/* Filters */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60">
          {(["ALL", "WIN", "LOSS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200",
                filter === tab
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "ALL" ? "All" : tab === "WIN" ? "Wins" : "Losses"}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-3 max-h-105 overflow-y-auto pr-1 
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20
        [&::-webkit-scrollbar-thumb]:rounded-full
        hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
      >        
      {filteredHistory.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Swords className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">No matches found matching the filter.</p>
          </div>
        ) : (
          filteredHistory.slice(0, 6).map((match) => {
            const opponentName = match.opponentId ? usernames[match.opponentId] || "Loading..." : "Practice Bot";
            const styles = getResultStyle(match.result);

            return (
              <div
                key={match.matchId}
                onClick={() => router.push(`/history/${match.matchId}`)}
                className={cn(
                  "relative group overflow-hidden rounded-xl border border-border/80 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300 hover:shadow-md cursor-pointer",
                  styles.border
                )}
              >
                {/* Left: Opponent, Outcome Badge */}
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-foreground">
                        vs {opponentName}
                      </span>
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest",
                        styles.badge
                      )}>
                        {match.result}
                      </span>
                    </div>
                    {/* Subtext info */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(match.endedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Stats, Replay Action */}
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-border/40 pt-2 sm:border-0 sm:pt-0">
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(match.durationMs)}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      Turns: {match.turnCount}
                    </span>
                  </div>

                  <span className="text-xs font-black text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 select-none">
                    Watch Replay
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View All Button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/history")}
        className="w-full rounded-xl border border-border/60 hover:bg-muted/40 font-bold text-xs py-5"
      >
        See Full History
      </Button>
    </div>
  );
}
