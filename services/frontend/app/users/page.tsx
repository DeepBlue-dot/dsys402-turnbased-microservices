"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Trophy, Swords, ShieldAlert, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { playerApi } from "@/lib/api";
import type { PlayerSearchItem } from "@/lib/types";
import { getAvatarUrl } from "@/lib/utils";

export default function UsersPage() {
  const [players, setPlayers] = useState<PlayerSearchItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      playerApi
        .search({ search, limit: 20 })
        .then((res) => setPlayers(res.data))
        .catch(() => setPlayers([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Player Directory
        </h1>
        <p className="text-muted-foreground mt-1">
          Search and view details of public player profiles and global rankings.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9 bg-card"
          placeholder="Search players by username..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No players found matching your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {players.map((player) => (
            <Link href={`/users/${player.id}`} key={player.id} className="block">
              <Card className="group relative overflow-hidden border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5">
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Player Avatar */}
                  <div className="relative shrink-0">
                    {getAvatarUrl(player.avatarUrl) ? (
                      <img
                        src={getAvatarUrl(player.avatarUrl) || undefined}
                        alt={`${player.username || "player"}'s avatar`}
                        className="h-12 w-12 rounded-full object-cover border border-border shadow-sm animate-in fade-in duration-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const sibling = (e.target as HTMLElement).nextElementSibling;
                          if (sibling) sibling.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-black text-white text-lg select-none shadow-sm uppercase ${
                        getAvatarUrl(player.avatarUrl) ? "hidden" : ""
                      }`}
                    >
                      {player.username ? player.username.charAt(0).toUpperCase() : "?"}
                    </div>
                  </div>

                  {/* Player Name and Elo */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base truncate text-foreground group-hover:text-primary transition-colors duration-200">
                        {player.username || "unknown"}
                      </h3>
                    </div>

                    {/* Stats details */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <Trophy className="h-3.5 w-3.5" />
                        {player.stats?.rating ?? 1000} Elo
                      </span>
                      <span className="text-muted-foreground/60 hidden sm:inline">•</span>
                      <span>
                        {player.stats
                          ? `${player.stats.wins}W / ${player.stats.losses}L / ${player.stats.draws}D`
                          : "No stats recorded"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-primary/80 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 inline-flex items-center gap-1">
                      Profile →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
