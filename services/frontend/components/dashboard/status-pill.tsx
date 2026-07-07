"use client";

import { cn } from "@/lib/utils";
import type { PlayerStatus } from "@/lib/types";

export function StatusPill({ status }: { status: PlayerStatus | string }) {
  const styles: Record<string, string> = {
    IDLE: "border-primary/30 bg-primary/10 text-primary",
    QUEUED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    IN_GAME: "border-green-400/30 bg-green-400/10 text-green-300",
    OFFLINE: "border-muted bg-muted/40 text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
        styles[status] || styles.OFFLINE,
      )}
    >
      {status === "IDLE" ? "online" : status.replace("_", " ")}
    </span>
  );
}
