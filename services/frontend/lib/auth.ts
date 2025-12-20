import { api } from "./api";

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
};

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", {
    email,        // ✅ MUST be email
    password,
  });

  const token = res.data.token;
  localStorage.setItem("token", token);

  return token;
}

export async function register(data: RegisterPayload) {
  const res = await api.post("/auth/register", data);
  return res.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    localStorage.removeItem("token");
  }
}
