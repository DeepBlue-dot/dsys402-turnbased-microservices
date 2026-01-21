import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err);
});