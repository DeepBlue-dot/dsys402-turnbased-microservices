"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { cn, getAvatarUrl } from "@/lib/utils";
import type { GameSymbol } from "@/lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function formatStatus(status?: string) {
  if (!status) return "Offline";
  if (status === "IDLE") return "online";
  return status.replaceAll("_", " ").toLowerCase();
}

function statusClasses(status?: string) {
  if (status === "IN_GAME") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "IDLE") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "QUEUED") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-muted bg-muted/40 text-muted-foreground";
}

export function PlayerPanel({
  align = "left",
  label,
  name,
  playerId,
  rating,
  record,
  status,
  symbol,
  supporting,
  avatarUrl,
}: {
  align?: "left" | "right";
  label: string;
  name: string;
  playerId?: string;
  rating: number;
  record: string;
  status: string;
  symbol: GameSymbol;
  supporting: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className={cn(
      "rounded-md border border-border bg-card p-3",
      align === "right" && "text-right",
    )}>
      <div className={cn(
        "flex items-start gap-3",
        align === "right" && "flex-row-reverse",
      )}>
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 font-bold overflow-hidden">
          {name === "Waiting for opponent" ? (
            <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : playerId ? (
            <Link href={`/users/${playerId}`} className="relative w-full h-full block hover:text-primary transition-colors">
              {getAvatarUrl(avatarUrl) ? (
                <img
                  src={getAvatarUrl(avatarUrl) || undefined}
                  alt={`${name}'s avatar`}
                  className="h-full w-full object-cover animate-in fade-in duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                    const sibling = (e.target as HTMLElement).nextElementSibling;
                    if (sibling) sibling.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/80 to-accent/80 text-white select-none uppercase font-black w-full h-full text-xs",
                  getAvatarUrl(avatarUrl) ? "hidden" : ""
                )}
              >
                {initials(name)}
              </div>
            </Link>
          ) : (
            <div className="relative w-full h-full block">
              {getAvatarUrl(avatarUrl) ? (
                <img
                  src={getAvatarUrl(avatarUrl) || undefined}
                  alt={`${name}'s avatar`}
                  className="h-full w-full object-cover animate-in fade-in duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                    const sibling = (e.target as HTMLElement).nextElementSibling;
                    if (sibling) sibling.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/80 to-accent/80 text-white select-none uppercase font-black w-full h-full text-xs",
                  getAvatarUrl(avatarUrl) ? "hidden" : ""
                )}
              >
                {initials(name)}
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          {playerId && name !== "Waiting for opponent" ? (
            <Link
              href={`/users/${playerId}`}
              className="mt-1 block truncate text-lg font-bold hover:text-primary hover:underline transition-colors"
            >
              {name}
            </Link>
          ) : (
            <p className="mt-1 truncate text-lg font-semibold">{name}</p>
          )}
          <div className={cn(
            "mt-2 flex flex-wrap gap-2",
            align === "right" && "justify-end",
          )}>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs capitalize",
              statusClasses(status),
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {formatStatus(status)}
            </span>
            <span className="rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
              {rating} Elo
            </span>
          </div>
        </div>
        <span className={cn(
          "text-3xl font-black",
          symbol === "X" ? "text-primary" : "text-accent",
        )}>
          {symbol}
        </span>
      </div>
      <div className={cn(
        "mt-3 grid gap-1 text-xs text-muted-foreground",
        align === "right" && "justify-items-end",
      )}>
        <span>{record}</span>
        <span>{supporting}</span>
      </div>
    </div>
  );
}
