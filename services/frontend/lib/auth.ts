import { authApi } from "@/lib/api";
import { clearToken, setToken } from "@/lib/session";
import type { RegisterPayload } from "@/lib/types";

export async function login(email: string, password: string) {
  const { token } = await authApi.login({ email, password });
  setToken(token);
  return token;
}

export async function register(data: RegisterPayload) {
  return authApi.register(data);
}

export async function logout() {
  try {
    await authApi.logout();
  } finally {
    clearToken();
  }
}
