"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Compass,
  Cpu,
  Loader2,
  LogOut,
  Play,
  Radio,
  RefreshCcw,
  Swords,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CurrentPlayerState } from "@/lib/types";

interface LiveStateProps {
  connectionState: string;
  isConnected: boolean;
  livePlayer: CurrentPlayerState;
  liveOpponentUsername: string;
  sync: () => void;
  handleLeaveQueue: () => Promise<void>;
  logout: () => void;
}

export function LiveState({
  connectionState,
  isConnected,
  livePlayer,
  liveOpponentUsername,
  sync,
  handleLeaveQueue,
  logout,
}: LiveStateProps) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);

  const status = livePlayer.status || "IDLE";
  const isQueued = status === "QUEUED";
  const inGame = status === "IN_GAME";
  const canResume = inGame && livePlayer.game;

  useEffect(() => {
    if (!livePlayer?.queue) {
      setElapsed(0);
      return;
    }

    const initialWait = livePlayer.queue.waitTimeSeconds || 0;
    const start = Date.now() - initialWait * 1000;

    setElapsed(initialWait);

    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [livePlayer?.queue?.waitTimeSeconds, !livePlayer?.queue]);

  return (
    <div className="space-y-5">
      {/* Action Zone Container */}
      <Card className="overflow-hidden border border-border/80 bg-card/40 backdrop-blur-xl shadow-lg relative">
        {/* Dynamic decorative backdrop accents */}
        {isQueued && (
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
        )}
        {inGame && (
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none" />
        )}

        <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3">
          <CardTitle className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
            <Radio className={cn("h-4.5 w-4.5", isConnected ? "text-primary animate-pulse" : "text-muted-foreground")} />
            Lobby Gateway
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={sync}
              disabled={!isConnected}
              className="h-8 rounded-lg text-xs font-semibold px-2 hover:bg-muted/40"
            >
              <RefreshCcw className="h-3.5 w-3.5 mr-1" />
              Sync
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 rounded-lg text-xs font-semibold px-2 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Exit
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
          {status === "IDLE" && (
            // IDLE State View
            <div className="w-full space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-foreground">Welcome to the Arena</h3>
                <p className="text-xs text-muted-foreground">Find a ranked match and prove your ELO superiority.</p>
              </div>

              <Button
                size="lg"
                onClick={() => router.push("/matchmaking")}
                className="relative overflow-hidden w-full max-w-sm rounded-xl py-6 font-black tracking-wider text-sm shadow-md shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] bg-primary text-primary-foreground group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <Play className="h-4 w-4 mr-2 fill-current" />
                FIND MATCH
              </Button>
            </div>
          )}

          {isQueued && (
            // QUEUED State View
            <div className="w-full space-y-6 animate-in fade-in duration-200 flex flex-col items-center">
              {/* Radar Pulsing Animation */}
              <div className="relative flex items-center justify-center h-20 w-20">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500/20 opacity-75" />
                <span className="animate-pulse absolute inline-flex h-14 w-14 rounded-full bg-amber-500/10" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <Compass className="h-5 w-5 animate-spin" style={{ animationDuration: "8s" }} />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-amber-300">Scanning for Opponent...</h3>
                <p className="text-xs text-muted-foreground font-mono">
                  Wait: {elapsed}s | Position: {livePlayer.queue?.position ?? "Pending"}
                </p>
              </div>

              <Button
                variant="outline"
                size="lg"
                onClick={handleLeaveQueue}
                className="w-full max-w-sm rounded-xl py-5 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-all duration-200 hover:-translate-y-0.5"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Search
              </Button>
            </div>
          )}

          {inGame && (
            // IN_GAME State View
            <div className="w-full space-y-5 animate-in fade-in duration-200 flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 shadow-md">
                <Swords className="h-7 w-7 text-violet-400" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-violet-300">Match in Progress</h3>
                {canResume && (
                  <p className="text-xs text-muted-foreground">
                    Playing against <span className="font-bold text-foreground">{liveOpponentUsername}</span>
                  </p>
                )}
              </div>

              <Button
                size="lg"
                onClick={() => router.push("/game")}
                className="w-full max-w-sm rounded-xl py-6 font-black tracking-wider text-sm shadow-md shadow-violet-500/20 bg-violet-600 hover:bg-violet-700 text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Play className="h-4 w-4 mr-2 fill-current" />
                RETURN TO GAME
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Start Mode Selector (Only shown if IDLE) */}
      {status === "IDLE" && (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card/20 p-3.5 backdrop-blur-xl flex flex-col justify-between hover:border-primary/20 transition-all duration-200 cursor-pointer" onClick={() => router.push("/matchmaking")}>
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3">
              <Swords className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground mb-1">Ranked Match</h4>
              <p className="text-[10px] text-muted-foreground line-clamp-2">Standard competitive ELO-based ladder game.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/10 p-3.5 backdrop-blur-xl flex flex-col justify-between opacity-60 cursor-not-allowed">
            <div className="h-8 w-8 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center mb-3">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground mb-1">Practice Mode</h4>
              <p className="text-[10px] text-muted-foreground line-clamp-2">Play on a random board layout. (Coming Soon)</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/10 p-3.5 backdrop-blur-xl flex flex-col justify-between opacity-60 cursor-not-allowed">
            <div className="h-8 w-8 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center mb-3">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground mb-1">Friendly Duel</h4>
              <p className="text-[10px] text-muted-foreground line-clamp-2">Challenge your friends. (Coming Soon)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
