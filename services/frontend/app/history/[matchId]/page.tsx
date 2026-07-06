"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { historyApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BoardCell, MatchDetail } from "@/lib/types";

function normalizeBoard(board?: BoardCell[]) {
  if (!board || board.length !== 9) return Array(9).fill("") as BoardCell[];
  return board.map((cell) => (cell === "X" || cell === "O" ? cell : "")) as BoardCell[];
}

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.matchId) return;

    historyApi
      .byId(params.matchId)
      .then(setMatch)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load match."),
      );
  }, [params.matchId]);

  const board = normalizeBoard(match?.finalBoard);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/history")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        History
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!match ? (
        <p className="text-sm text-muted-foreground">Loading match...</p>
      ) : (
        <>
          <div>
            <h1 className="break-all text-2xl font-bold tracking-tight">
              {match.matchId}
            </h1>
            <p className="text-muted-foreground">
              {match.result} · {match.reason.toLowerCase()} · {match.turnCount} turns
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Final Board</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid aspect-square grid-cols-3 gap-2">
                  {board.map((cell, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-center rounded-md border border-border bg-card text-4xl font-black",
                        cell === "X" && "text-primary",
                        cell === "O" && "text-accent",
                      )}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Move Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {match.moves.map((move, index) => (
                    <div
                      key={`${move.at}-${move.position}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm"
                    >
                      <div>
                        <p>
                          {index + 1}. {move.symbol} to cell {move.position + 1}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {move.playerId}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(move.at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
