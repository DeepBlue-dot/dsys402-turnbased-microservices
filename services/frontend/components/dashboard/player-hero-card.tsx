"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Award, Flame, ShieldAlert, Trophy, Zap } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PlayerHeroCardProps {
  user: any;
  livePlayer: any;
  streak: number;
  streakType: "win" | "loss" | "none";
}

export function PlayerHeroCard({ user, livePlayer, streak, streakType }: PlayerHeroCardProps) {
  const router = useRouter();
  const status = livePlayer.status || "IDLE";
  
  // Dynamic design tokens based on player status
  const theme = {
    IDLE: {
      bg: "from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20",
      avatarGlow: "shadow-blue-500/30 border-blue-500/40",
      avatarPulse: "bg-blue-500",
      badgeText: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      badgeLabel: "online",
      glowBg: "bg-blue-500/5",
    },
    QUEUED: {
      bg: "from-amber-500/15 via-orange-500/5 to-transparent border-amber-500/30",
      avatarGlow: "shadow-amber-500/40 border-amber-500/50 animate-pulse",
      avatarPulse: "bg-amber-400 animate-ping",
      badgeText: "text-amber-300 bg-amber-500/10 border-amber-500/30",
      badgeLabel: "queued",
      glowBg: "bg-amber-500/10",
    },
    IN_GAME: {
      bg: "from-violet-500/15 via-fuchsia-500/5 to-transparent border-violet-500/30",
      avatarGlow: "shadow-violet-500/40 border-violet-500/50",
      avatarPulse: "bg-violet-400 animate-pulse",
      badgeText: "text-violet-300 bg-violet-500/10 border-violet-500/30",
      badgeLabel: "in game",
      glowBg: "bg-violet-500/10",
    },
    OFFLINE: {
      bg: "from-zinc-500/10 via-zinc-800/5 to-transparent border-zinc-700/20",
      avatarGlow: "shadow-zinc-700/20 border-zinc-600/30",
      avatarPulse: "bg-zinc-500",
      badgeText: "text-zinc-400 bg-zinc-700/20 border-zinc-600/20",
      badgeLabel: "offline",
      glowBg: "bg-zinc-500/5",
    },
  }[status as "IDLE" | "QUEUED" | "IN_GAME" | "OFFLINE"] || {
    bg: "from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20",
    avatarGlow: "shadow-blue-500/30 border-blue-500/40",
    avatarPulse: "bg-blue-500",
    badgeText: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    badgeLabel: "online",
    glowBg: "bg-blue-500/5",
  };

  const stats = livePlayer?.stats || { wins: 0, losses: 0, draws: 0 };
  const totalMatches = stats.wins + stats.losses + stats.draws;
  const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
  const rating = livePlayer?.rating || 1000;

  const avatarSrc = getAvatarUrl(livePlayer.profile?.avatarUrl);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-card/40 p-6 backdrop-blur-xl transition-all duration-500 shadow-xl",
      theme.bg
    )}>
      {/* Ambient background glow */}
      <div className={cn("absolute -left-20 -top-20 h-48 w-48 rounded-full blur-[80px] pointer-events-none", theme.glowBg)} />

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
        {/* Left Side: Avatar, Username, Status */}
        <div className="flex items-center gap-4.5">
          {/* Avatar Container */}
          <div className="relative group cursor-pointer" onClick={() => router.push("/settings")}>
            <div className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-full border-2 bg-muted shadow-lg transition-transform duration-300 hover:scale-105 overflow-hidden",
              theme.avatarGlow
            )}>
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt={user.username}
                  fill
                  sizes="80px"
                  priority
                  className="object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-muted-foreground uppercase select-none">
                  {user.username.slice(0, 2)}
                </span>
              )}
            </div>
            {/* Status dot in the corner */}
            <span className="absolute bottom-0.5 right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-background bg-background shadow-sm">
              <span className={cn("h-2.5 w-2.5 rounded-full", theme.avatarPulse)} />
            </span>
          </div>

          {/* Username & Status Badge */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
                {user.username}
              </h2>
              <span className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider select-none",
                theme.badgeText
              )}>
                {theme.badgeLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs line-clamp-1 italic">
              {livePlayer.profile?.bio || "No bio set yet. Click avatar to edit."}
            </p>
          </div>
        </div>

        {/* Right Side: ELO Rating, Stats, Streak */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* ELO Card */}
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 min-w-28 text-center shadow-inner">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 flex items-center justify-center gap-1">
              <Trophy className="h-3 w-3 text-amber-400" />
              Rating
            </p>
            <p className="font-mono text-2xl font-black text-foreground">{rating}</p>
          </div>

          {/* Win Rate Card */}
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 min-w-28 text-center shadow-inner">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 flex items-center justify-center gap-1">
              <Award className="h-3 w-3 text-emerald-400" />
              Win Rate
            </p>
            <p className="font-mono text-2xl font-black text-foreground">
              {winRate}%
            </p>
          </div>

          {/* Streak Badge */}
          {streakType !== "none" && streak > 0 && (
            <div className={cn(
              "rounded-xl border px-4 py-3 min-w-28 text-center shadow-inner flex flex-col items-center justify-center",
              streakType === "win"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            )}>
              <p className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                {streakType === "win" ? (
                  <>
                    <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500 animate-bounce" />
                    Streak
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive animate-pulse" />
                    Cold Streak
                  </>
                )}
              </p>
              <p className="font-mono text-xl font-black tracking-tight flex items-center gap-1">
                {streak} {streakType === "win" ? "Wins" : "Losses"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
