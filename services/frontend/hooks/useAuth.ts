"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";

interface User {
  id: string;
  username: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.me(token);
      setUser(res.data);
    } catch (err: any) {
      console.error("Auth check failed:", err.message);
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    refreshUser: fetchUser // Exposed so login/register can trigger this
  };
}
