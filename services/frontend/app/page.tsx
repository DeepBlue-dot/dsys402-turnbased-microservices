"use client";

import Link from "next/link";
import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Turn-Based Multiplayer Game</h1>
      <p>Play competitive turn-based games online.</p>

      {!user ? (
        <div style={{ marginTop: "1rem" }}>
          <Link href="/login">Login</Link>{" "}
          <Link href="/register">Register</Link>
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <p>Welcome back, <strong>{user.username}</strong>!</p>
          <Link href="/dashboard">Go to Dashboard →</Link>
        </div>
      )}
    </main>
  );
}
