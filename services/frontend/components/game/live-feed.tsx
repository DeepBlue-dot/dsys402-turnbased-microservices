"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedItem } from "@/lib/types";

export function LiveFeed({ feed }: { feed: FeedItem[] }) {
  const visibleFeed = feed.filter((item) => !item.title.toLowerCase().includes("draw"));

  return (
    <div className="flex h-full flex-col rounded-2xl bg-transparent p-0">
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-background/40 px-3 py-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Live Feed</h2>
      </div>
      {visibleFeed.length === 0 ? (
        <div className="flex min-h-[24rem] flex-1 items-center justify-center rounded-xl bg-background/30 p-3 text-center text-xs text-muted-foreground">
          No live moves yet.
        </div>
      ) : (
        <div className="max-h-[22rem] flex-1 overflow-y-auto rounded-xl bg-background/30 p-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
          <ol className="space-y-1.5">
            {visibleFeed.map((item) => (
              <li key={item.id} className="rounded-md border border-border/60 bg-transparent px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.symbol && (
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-black",
                      item.symbol === "X"
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/10 text-accent",
                    )}>
                      {item.symbol}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.at}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
