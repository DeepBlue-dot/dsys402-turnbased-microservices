import { Redis } from "ioredis";
import { config } from "./env.js";

/**
 * Initialize Redis Client
 * ioredis handles reconnection automatically by default.
 */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Recommended for compatibility with some queue libraries
});

redis.on("connect", () => {
  console.log("[PlayerService] Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("[PlayerService] Redis connection error:", err);
});

// Optional: Graceful shutdown handler
process.on("SIGINT", async () => {
  await redis.quit();
  process.exit(0);
});