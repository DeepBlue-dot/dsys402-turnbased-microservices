"use client";

import Image from "next/image";
import { Crown, Medal, Trophy, User } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LeaderboardPeekProps {
  players: any[];
  currentUserId?: string;
}

export function LeaderboardPeek({ players, currentUserId }: LeaderboardPeekProps) {
  // Sort players just in case (though API already sorts by rating desc)
  const sortedPlayers = [...players].sort((a, b) => {
    const rA = a.stats?.rating ?? 1000;
    const rB = b.stats?.rating ?? 1000;
    return rB - rA;
  }).slice(0, 5);

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-4.5 w-4.5 text-yellow-400 fill-yellow-400/20" />;
      case 1:
        return <Medal className="h-4.5 w-4.5 text-zinc-300 fill-zinc-300/20" />;
      case 2:
        return <Medal className="h-4.5 w-4.5 text-amber-600 fill-amber-600/20" />;
      default:
        return <span className="text-xs font-black text-muted-foreground w-4.5 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/40 p-5 backdrop-blur-xl shadow-lg space-y-4">
      <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-400" />
        Leaderboard Peak
      </h3>

      <div className="space-y-2.5">
        {sortedPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No top players found.</p>
        ) : (
          sortedPlayers.map((player, index) => {
            const isMe = player.id === currentUserId;
            const rating = player.stats?.rating ?? 1000;
            const avatarSrc = getAvatarUrl(player.avatarUrl);

            return (
              <div
                key={player.id}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl border border-transparent transition-all duration-200 hover:bg-muted/30",
                  isMe && "border-primary/20 bg-primary/5 hover:bg-primary/10 shadow-sm"
                )}
              >
                {/* Left side: Rank, Avatar, Username */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6">
                    {getRankBadge(index)}
                  </div>

                  <div className="relative h-8 w-8 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden shadow-sm">
                    {avatarSrc ? (
                      <Image
                        src={avatarSrc}
                        alt={player.username || "player"}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className={cn(
                      "text-xs font-bold text-foreground truncate max-w-[120px] sm:max-w-[160px]",
                      isMe && "text-primary"
                    )}>
                      {player.username || player.email || "Unknown"}
                    </p>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase text-primary tracking-wider">
                        You
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Rating */}
                <span className="font-mono text-xs font-black text-muted-foreground bg-muted/40 border border-border/60 px-2 py-1 rounded-lg">
                  {rating} ELO
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
