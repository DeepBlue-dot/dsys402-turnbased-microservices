"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type PlayerSearchResult = {
  id: string;
  username?: string;
  email?: string;
  stats?: {
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  } | null;
};

export default function UsersPage() {
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      api
        .get<{ data: PlayerSearchResult[] }>("/player/search", {
          params: { search, limit: 20 },
        })
        .then((res) => setPlayers(res.data.data))
        .catch(() => setPlayers([]));
    }, 250);

    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        <p className="text-muted-foreground">Search public player profiles.</p>
      </div>

      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search username"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {players.map((player) => (
          <Card key={player.id}>
            <CardHeader>
              <CardTitle className="truncate text-lg">
                {player.username || player.email || player.id}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-mono">{player.stats?.rating ?? 1000}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
