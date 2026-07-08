"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Radio, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { matchmakingApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import type { CurrentPlayerState } from "@/lib/types";

export function MatchmakingView() {
  const { player, refreshUser, user } = useAuth();
  const {
    connectionState,
    isConnected,
    sync,
    liveStatus,
    liveQueue,
    liveGame,
    notice,
    clearNotice,
  } = useGameSocket();

  const requestedJoinRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueStartedAt, setQueueStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const livePlayer = useMemo<Partial<CurrentPlayerState> | null>(() => {
    if (!player) return null;

    return {
      ...player,
      game: liveGame || player.game,
      queue: liveQueue || player.queue,
      status: liveStatus !== "OFFLINE" ? liveStatus : player.status,
    };
  }, [player, liveGame, liveQueue, liveStatus]);

  useEffect(() => {
    if (!isConnected) {
      requestedJoinRef.current = false;
    }
  }, [isConnected]);

  useEffect(() => {
    if (livePlayer?.status === "QUEUED" && livePlayer.queue) {
      const initialWait = livePlayer.queue.waitTimeSeconds || 0;
      const calculatedStart = Date.now() - initialWait * 1000;
      setQueueStartedAt((prev) => {
        if (prev === null || Math.abs(prev - calculatedStart) > 2000) {
          return calculatedStart;
        }
        return prev;
      });
    } else if (livePlayer?.status !== "QUEUED") {
      setQueueStartedAt(null);
      setElapsed(0);
    }
  }, [livePlayer?.status, livePlayer?.queue?.waitTimeSeconds]);

  useEffect(() => {
    if (!queueStartedAt) {
      setElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - queueStartedAt) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [queueStartedAt]);

  useEffect(() => {
    if (!isConnected || !user || !player || requestedJoinRef.current) return;

    if (livePlayer?.status === "QUEUED") {
      requestedJoinRef.current = true;
      const initialWait = livePlayer.queue?.waitTimeSeconds || 0;
      setQueueStartedAt(Date.now() - initialWait * 1000);
      return;
    }

    requestedJoinRef.current = true;
    setJoining(true);
    setError(null);
    clearNotice();

    matchmakingApi
      .join()
      .then(() => {
        setQueueStartedAt(Date.now());
        return refreshUser();
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to join queue.";
        if (message.includes("already searching")) {
          setQueueStartedAt(Date.now());
          return;
        }
        setError(message);
      })
      .finally(() => setJoining(false));
  }, [isConnected, player, livePlayer?.status, refreshUser, user, clearNotice]);

  async function leaveQueue() {
    setError(null);
    try {
      await matchmakingApi.leave();
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave queue.");
    }
  }

  if (!user) return null;

  const waitTime = elapsed;
  const position = livePlayer?.queue?.position;

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center p-2">
      <Card className="w-full max-w-lg overflow-hidden border border-border/80 bg-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-inner relative">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-primary/20 opacity-75" />
                <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" aria-hidden="true" />
              </>
            ) : (
              <Radio className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <CardTitle className="text-3xl font-black">Scanning Network</CardTitle>
          <CardDescription>
            Searching for a compatible opponent. Keep this tab open.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-inner">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Socket</p>
              <p className="truncate font-mono text-xs font-semibold">{connectionState}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-inner">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Wait</p>
              <p className="font-mono text-sm font-bold">{waitTime}s</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-inner">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Position</p>
              <p className="font-mono text-sm font-bold">{position ?? "..."}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            {joining
              ? "Registering you with matchmaking..."
              : isConnected
                ? "Allocating match instances. Make sure your gateway is synced."
                : "Connecting to the websocket gateway..."}
          </div>

          {(error || notice) && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error || notice}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/40 pt-4">
          <Button variant="ghost" onClick={leaveQueue} className="rounded-xl hover:bg-muted/40 font-bold text-xs">
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Exit Queue
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => sync()} disabled={!isConnected} className="rounded-xl font-bold text-xs">
              <RefreshCcw className="h-4 w-4 mr-2" aria-hidden="true" />
              Sync
            </Button>
            <Button variant="outline" onClick={leaveQueue} className="rounded-xl border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 font-bold text-xs">
              <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              Leave
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
