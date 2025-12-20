"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { logout as clearAuth } from "../lib/auth";

interface User {
  id: string;
  username: string;
  // add other user properties as needed
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    try {
      const res = await api.get("/me");
      setUser(res.data);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "message" in err && (err as { message?: string }).message === "UNAUTHORIZED") {
        setUser(null); // user not logged in → OK
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  function logout() {
    clearAuth();
    setUser(null);
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
  };
}
