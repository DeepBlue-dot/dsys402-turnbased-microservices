/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { CurrentPlayerState, PlayerStatus } from "@/lib/types";

export default function MatchmakingPage() {
  const router = useRouter();
  const { loading, player, refreshUser, user } = useAuth();
  const {
    connectionState,
    isConnected,
    sync,
    liveStatus,
    liveQueue,
    liveGame,
    notice,
    clearNotice,
  } = useGameSocket(!!user);
  const requestedJoinRef = useRef(false);
  const prevStatusRef = useRef<PlayerStatus>("OFFLINE");
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
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!queueStartedAt) return;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - queueStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [queueStartedAt]);

  useEffect(() => {
    if (liveStatus === "IN_GAME" || (livePlayer?.game && livePlayer.game.status === "ACTIVE")) {
      router.push("/game");
    } else if (
      liveStatus === "IDLE" &&
      prevStatusRef.current === "QUEUED" &&
      requestedJoinRef.current &&
      !joining
    ) {
      router.push("/dashboard");
    }
    prevStatusRef.current = liveStatus;
  }, [liveStatus, livePlayer?.game, router, joining]);

  useEffect(() => {
    if (!isConnected || !user || requestedJoinRef.current) return;

    if (livePlayer?.status === "IN_GAME" || (livePlayer?.game && livePlayer.game.status === "ACTIVE")) {
      router.push("/game");
      return;
    }

    if (livePlayer?.status === "QUEUED") {
      requestedJoinRef.current = true;
      setQueueStartedAt(Date.now());
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
  }, [isConnected, livePlayer?.game, livePlayer?.status, refreshUser, router, user, clearNotice]);

  async function leaveQueue() {
    setError(null);
    try {
      await matchmakingApi.leave();
      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave queue.");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="animate-pulse text-muted-foreground">Preparing queue...</p>
      </div>
    );
  }

  const waitTime = livePlayer?.queue?.waitTimeSeconds ?? elapsed;
  const position = livePlayer?.queue?.position;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-2">
      <Card className="w-full max-w-lg overflow-hidden">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
            {isConnected ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <Radio className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <CardTitle className="text-3xl">Scanning Network</CardTitle>
          <CardDescription>
            The gateway connection must be online before the queue can register
            your presence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Socket</p>
              <p className="truncate font-mono text-sm">{connectionState}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Wait</p>
              <p className="font-mono text-sm">{waitTime}s</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Position</p>
              <p className="font-mono text-sm">{position ?? "..."}</p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            {joining
              ? "Registering you with matchmaking..."
              : isConnected
                ? "Searching for a compatible opponent. Keep this tab open."
                : "Connecting to the websocket gateway..."}
          </div>

          {(error || notice) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error || notice}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => sync()} disabled={!isConnected}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Sync
            </Button>
            <Button variant="outline" onClick={leaveQueue}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Leave
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
