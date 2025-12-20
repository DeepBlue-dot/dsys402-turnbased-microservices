import axios from "axios";

// Base URLs for the services
const AUTH_SERVICE_URL = "http://localhost:4001";
const GATEWAY_URL = "http://localhost:4000";

// Axios instance for Auth Service
const authApi = axios.create({
    baseURL: AUTH_SERVICE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Axios instance for Event Service (Gateway)
const gatewayApi = axios.create({
    baseURL: GATEWAY_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add interceptor to inject token into Gateway requests
gatewayApi.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const api = {
    auth: {
        register: (data: any) => authApi.post("/api/auth/register", data),
        login: (data: any) => authApi.post("/api/auth/login", data),
        me: (token: string) =>
            authApi.get("/api/me", {
                headers: { Authorization: `Bearer ${token}` },
            }),
    },
    matchmaking: {
        join: (playerId: string) => gatewayApi.post("/matchmaking/join", { playerId }),
    },
    game: {
        move: (matchId: string, playerId: string, position: number) =>
            gatewayApi.post("/game/move", { matchId, playerId, position }),
    },
};
