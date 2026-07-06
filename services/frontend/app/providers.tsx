"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { GameSocketProvider } from "@/hooks/useGameSocket";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GameSocketProvider>{children}</GameSocketProvider>
    </AuthProvider>
  );
}
