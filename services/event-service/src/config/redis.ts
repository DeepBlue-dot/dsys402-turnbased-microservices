import { Redis } from "ioredis";
import { config } from "./env.js";
export const redis = new Redis(config.redisUrl);

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err);
});