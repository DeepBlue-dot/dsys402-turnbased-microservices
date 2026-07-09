"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/lib/types";

function formatStatus(status?: string) {
  if (!status) return "Offline";
  if (status === "IDLE") return "online";
  return status.replaceAll("_", " ").toLowerCase();
}

export function MatchChat({
  chat,
  chatText,
  setChatText,
  canChat,
  opponentLabel,
  opponentStatus,
  opponentId,
  userId,
  onSendChat,
}: {
  chat: ChatItem[];
  chatText: string;
  setChatText: (text: string) => void;
  canChat: boolean;
  opponentLabel: string;
  opponentStatus: string;
  opponentId?: string | null;
  userId?: string;
  onSendChat: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-transparent p-0">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-background/40 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Match Chat</h2>
          <p className="text-[11px] text-muted-foreground">
            {opponentId
              ? `To ${opponentLabel} (${formatStatus(opponentStatus)})`
              : "Waiting for opponent"}
          </p>
        </div>
        <div className="rounded-full border border-border/70 bg-muted/40 p-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div className="mb-3 flex max-h-[22rem] min-h-[24rem] flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-background/30 p-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
        {chat.length === 0 ? (
          <p className="m-auto px-3 text-center text-xs text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          chat.map((item) => (
            <div
              key={item.id}
              className={cn(
                "max-w-[88%] rounded-xl border px-2.5 py-2 text-sm shadow-sm",
                item.from === "me" && "ml-auto border-primary/30 bg-primary/10",
                item.from === "opponent" && "mr-auto border-border/70 bg-card/80",
                item.from === "system" && "mx-auto border-muted bg-muted/40 text-muted-foreground",
              )}
            >
              <p className="text-[13px] leading-5">{item.text}</p>
              <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                {item.from === "me" ? (
                  <Link href={`/users/${userId}`} className="transition-colors hover:text-primary hover:underline">You</Link>
                ) : item.from === "opponent" && opponentId ? (
                  <Link href={`/users/${opponentId}`} className="transition-colors hover:text-primary hover:underline">{opponentLabel}</Link>
                ) : null}
                <span>· {item.at}</span>
                {item.from === "me" && (
                  <span className="ml-1 text-[11px] text-primary">
                    {item.status === "pending" ? "✓" : item.status === "failed" ? "✕" : "✓✓"}
                  </span>
                )}
              </p>
            </div>
          ))
        )}
      </div>

      <form className="mt-auto flex items-center gap-2 rounded-xl bg-background/40 p-2" onSubmit={onSendChat}>
        <Input
          aria-label="Match chat message"
          value={chatText}
          onChange={(event) => setChatText(event.target.value)}
          placeholder={canChat ? "Message opponent..." : "Chat unavailable"}
          maxLength={240}
          disabled={!canChat}
          className="h-9 rounded-xl border-border/70 bg-background/70 text-sm"
        />
        <Button type="submit" size="sm" disabled={!canChat || !chatText.trim()} className="h-9 rounded-xl px-3">
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
