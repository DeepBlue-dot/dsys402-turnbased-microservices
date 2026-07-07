"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { authApi, playerApi, ApiError } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/session";
import type { CurrentPlayerState, LoginPayload, RegisterPayload } from "@/lib/types";

type AuthUser = {
  id: string;
  email: string;
  username: string;
  rating: number;
  status: CurrentPlayerState["status"];
  avatarUrl: string | null;
};

type AuthContextValue = {
  error: string | null;
  hasToken: () => boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<CurrentPlayerState | null>;
  logout: () => Promise<void>;
  player: CurrentPlayerState | null;
  refreshUser: () => Promise<CurrentPlayerState | null>;
  register: (payload: RegisterPayload) => Promise<CurrentPlayerState | null>;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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

      // Only clear token and log out if it is a definitive 401 Unauthorized or 403 Forbidden.
      // Other errors (e.g. 500, network offline) should not wipe the session.
      const isAuthError = err instanceof ApiError && (err.status === 401 || err.status === 403);
      if (isAuthError) {
        clearToken();
        setPlayer(null);
      }
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
      try {
        const { token } = await authApi.login(payload);
        setToken(token);
        return await refreshUser();
      } catch (err) {
        setLoading(false);
        throw err;
      }
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
      avatarUrl: player.profile?.avatarUrl || null,
    };
  }, [player]);

  const hasToken = useCallback(() => {
    return !!getToken();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
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
  }), [
    error,
    loading,
    login,
    logout,
    player,
    refreshUser,
    register,
    user,
    hasToken,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
