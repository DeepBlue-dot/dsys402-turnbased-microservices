"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, playerApi } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/session";
import type { CurrentPlayerState, LoginPayload, RegisterPayload } from "@/lib/types";

export function useAuth() {
  const [player, setPlayer] = useState<CurrentPlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setPlayer(null);
      setLoading(false);
      return null;
    }

    try {
      setError(null);
      const nextPlayer = await playerApi.me();
      setPlayer(nextPlayer);
      return nextPlayer;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auth check failed";
      setError(message);
      clearToken();
      setPlayer(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      setError(null);
      const { token } = await authApi.login(payload);
      setToken(token);
      return refreshUser();
    },
    [refreshUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await authApi.register(payload);
      return login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local logout still succeeds if the backend is unavailable.
    } finally {
      clearToken();
      setPlayer(null);
    }
  }, []);

  const user = useMemo(() => {
    if (!player) return null;

    return {
      id: player.userId,
      email: player.email,
      username: player.profile?.username || player.email,
      rating: player.rating,
      status: player.status,
    };
  }, [player]);

  function hasToken() {
    return !!getToken();
  }

  return {
    error,
    hasToken,
    isAuthenticated: !!player,
    loading,
    login,
    logout,
    player,
    refreshUser,
    register,
    user,
  };
}
