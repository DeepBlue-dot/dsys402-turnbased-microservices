"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { historyApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { GameResult, MatchHistoryItem } from "@/lib/types";

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [result, setResult] = useState<GameResult | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);

      historyApi
        .mine({
          page: 1,
          limit: 20,
          result: result || undefined,
          search: search || undefined,
          sortBy: "endedAt",
          order: "desc",
        })
        .then((res) => setMatches(res.data))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Failed to load history."),
        )
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [result, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Match History</h1>
        <p className="text-muted-foreground">
          Review completed games saved by the game logic service.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Search match or opponent id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Result filter</span>
          <select
            className="h-10 bg-transparent text-sm outline-none"
            value={result}
            onChange={(event) => setResult(event.target.value as GameResult | "")}
          >
            <option value="">All results</option>
            <option value="WIN">Wins</option>
            <option value="LOSS">Losses</option>
            <option value="DRAW">Draws</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading matches...</p>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No matches found.
            </CardContent>
          </Card>
        ) : (
          matches.map((match) => (
            <Card key={match.matchId}>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="truncate font-mono text-sm">
                    {match.matchId}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    vs {match.opponentId || "unknown"} · {match.turnCount} turns
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-bold",
                    match.result === "WIN" && "bg-green-400/10 text-green-300",
                    match.result === "LOSS" && "bg-red-400/10 text-red-300",
                    match.result === "DRAW" && "bg-muted text-muted-foreground",
                  )}
                >
                  {match.result}
                </span>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {new Date(match.endedAt).toLocaleString()}
                </span>
                <Link href={`/history/${match.matchId}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
