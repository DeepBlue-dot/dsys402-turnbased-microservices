"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { GameSocketProvider } from "@/hooks/useGameSocket";
import { RematchToast } from "@/components/game/rematch-toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GameSocketProvider>
        {children}
        <RematchToast />
      </GameSocketProvider>
    </AuthProvider>
  );
}
