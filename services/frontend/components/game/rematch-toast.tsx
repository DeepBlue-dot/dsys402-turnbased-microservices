"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useAuth } from "@/hooks/useAuth";

export function RematchToast() {
  const { rematchState, requestRematch, declineRematch } = useGameSocket(true);
  const { user } = useAuth();
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rematchState || rematchState.status !== "pending") {
      setVisible(false);
      setMatchId(null);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (rematchState.requestedBy === user?.id) return; // ignore our own requests

    const id = rematchState.matchId;
    if (!id) return;

    let dismissed = false;
    try {
      dismissed = !!sessionStorage.getItem(`dismissedOverlay:${id}`);
    } catch (err) {
      dismissed = false;
    }

    if (!(dismissed || pathname !== "/dashboard")) {
      // overlay visible and on dashboard; no popup
      return;
    }

    // If same match already visible, do nothing
    if (visible && matchId === id) return;

    setMatchId(id);
    setVisible(true);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      setMatchId(null);
      timerRef.current = null;
    }, 12000);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rematchState, user, pathname]);

  if (!visible || !matchId || !rematchState) return null;

  return (
    <div className="fixed right-4 top-20 z-50">
      <Card className="w-80 bg-white border border-border shadow-lg rounded-lg">
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">Rematch Offer</div>
              <div className="text-xs text-muted-foreground mt-1">Your opponent requested a rematch.</div>
            </div>
            <div className="text-xs text-muted-foreground">Incoming</div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                requestRematch(matchId);
                setVisible(false);
                setMatchId(null);
                if (timerRef.current) {
                  window.clearTimeout(timerRef.current);
                  timerRef.current = null;
                }
              }}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive"
              onClick={() => {
                declineRematch(matchId);
                setVisible(false);
                setMatchId(null);
                if (timerRef.current) {
                  window.clearTimeout(timerRef.current);
                  timerRef.current = null;
                }
              }}
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
