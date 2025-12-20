"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/users")
      .then(res => setUsers(res.data))
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1>Players</h1>
      <ul>
        {users.map(u => (
          <li key={u.id}>
            {u.username} — Rating {u.rating}
          </li>
        ))}
      </ul>
    </div>
  );
}
