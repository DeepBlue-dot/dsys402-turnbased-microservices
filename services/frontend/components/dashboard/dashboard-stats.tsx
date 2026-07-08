"use client";

import { Activity, Shield, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  stats: {
    wins: number;
    losses: number;
    draws: number;
    rating: number;
  };
  winRate: number;
  history?: any[];
}

export function DashboardStats({ stats, winRate, history = [] }: DashboardStatsProps) {
  // Compute simulated ELO points based on match history for the sparkline
  const computeEloTrend = () => {
    const currentElo = stats.rating || 1000;
    if (history.length === 0) {
      return [currentElo, currentElo, currentElo, currentElo, currentElo];
    }

    // Map outcomes (limit to last 10 games)
    const outcomes = history
      .slice(0, 10)
      .map((item: any) => {
        if (item.result === "WIN") return 15;
        if (item.result === "LOSS") return -15;
        return 0;
      })
      .reverse(); // oldest to newest

    const trend = [currentElo];
    let rollingElo = currentElo;
    // Walk backwards to reconstruct ELO values
    for (let i = outcomes.length - 1; i >= 0; i--) {
      rollingElo = rollingElo - outcomes[i];
      trend.unshift(rollingElo);
    }
    return trend;
  };

  const eloTrend = computeEloTrend();
  
  // Render an SVG sparkline path
  const renderSparkline = (points: number[], strokeColor: string) => {
    if (points.length < 2) return null;
    const width = 120;
    const height = 36;
    const padding = 2;
    const min = Math.min(...points) - 5;
    const max = Math.max(...points) + 5;
    const range = max - min === 0 ? 1 : max - min;

    const coords = points.map((val, index) => {
      const x = (index / (points.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    });

    const pathData = `M ${coords.join(" L ")}`;

    return (
      <svg width={width} height={height} className="overflow-visible select-none">
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_2px_4px_var(--stroke-glow)]"
          style={{ "--stroke-glow": strokeColor } as any}
        />
        {/* Subtle filled area under line */}
        <path
          d={`${pathData} L ${width - padding},${height} L ${padding},${height} Z`}
          fill={`url(#gradient-${strokeColor.replace("#", "")})`}
          className="opacity-15"
        />
        <defs>
          <linearGradient id={`gradient-${strokeColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  // Radial progress for win rate
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {/* Rating Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/25 hover:shadow-lg hover:shadow-blue-500/5 flex flex-col justify-between min-h-32">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">Rating</span>
          <Shield className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex items-end justify-between mt-3">
          <div className="font-mono text-3xl font-black tracking-tight text-foreground">{stats.rating}</div>
          <div className="h-9 flex items-center">
            {renderSparkline(eloTrend, "#3b82f6")}
          </div>
        </div>
      </div>

      {/* Wins Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/5 flex flex-col justify-between min-h-32">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">Wins</span>
          <Trophy className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex items-end justify-between mt-3">
          <div className="font-mono text-3xl font-black tracking-tight text-emerald-400 drop-shadow-[0_2px_8px_rgba(52,211,153,0.15)]">{stats.wins}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            Champion
          </div>
        </div>
      </div>

      {/* Losses Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-destructive/25 hover:shadow-lg hover:shadow-destructive/5 flex flex-col justify-between min-h-32">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">Losses</span>
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex items-end justify-between mt-3">
          <div className="font-mono text-3xl font-black tracking-tight text-destructive drop-shadow-[0_2px_8px_rgba(239,68,68,0.15)]">{stats.losses}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-destructive/80 bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-md">
            Defeats
          </div>
        </div>
      </div>

      {/* Win Rate Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-accent/25 hover:shadow-lg hover:shadow-accent/5 flex flex-col justify-between min-h-32">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">Win Rate</span>
          <Activity className="h-5 w-5 text-purple-400" />
        </div>
        <div className="flex items-end justify-between mt-3">
          <div className="font-mono text-3xl font-black tracking-tight text-foreground">{winRate}%</div>
          {/* Radial progress circle */}
          <div className="relative h-12 w-12 flex items-center justify-center">
            <svg className="transform -rotate-90" width="44" height="44">
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-muted-foreground/10"
                strokeWidth="3.5"
                fill="transparent"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-purple-500 drop-shadow-[0_0_3px_rgba(168,85,247,0.4)]"
                strokeWidth="3.5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] font-black tracking-tighter">{winRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
