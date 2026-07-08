"use client";

import Image from "next/image";
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

export function PlayerPanel({
  align = "left",
  label,
  name,
  playerId,
  rating,
  symbol,
  avatarUrl,
  isActive = false,
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
  isActive?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all duration-200",
      isActive
        ? "border-primary/50 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_0_24px_rgba(34,211,238,0.12)]"
        : "border-border bg-card",
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
                <Image
                  src={getAvatarUrl(avatarUrl) || ""}
                  alt={`${name}'s avatar`}
                  fill
                  sizes="44px"
                  className="object-cover animate-in fade-in duration-200"
                  onError={(event) => {
                    const target = event.currentTarget as HTMLImageElement;
                    target.style.display = "none";
                    const sibling = target.nextElementSibling;
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
                <Image
                  src={getAvatarUrl(avatarUrl) || ""}
                  alt={`${name}'s avatar`}
                  fill
                  sizes="44px"
                  className="object-cover animate-in fade-in duration-200"
                  onError={(event) => {
                    const target = event.currentTarget as HTMLImageElement;
                    target.style.display = "none";
                    const sibling = target.nextElementSibling;
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
      </div>
    </div>
  );
}
