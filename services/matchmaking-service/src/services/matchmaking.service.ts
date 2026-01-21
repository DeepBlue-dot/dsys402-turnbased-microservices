import { redis } from "../config/redis.js";

const QUEUE_KEY = "match:queue:ranked";

export const joinMatchmaking = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  const playerData = await redis.hgetall(presenceKey);

  if (!playerData || Object.keys(playerData).length === 0) {
    throw new Error("Player presence not found. Please ensure you are connected.");
  }

  if (playerData.status === "QUEUED") {
    throw new Error("Already in queue");
  }

  if (playerData.status === "IN_GAME") {
    throw new Error("Already in a match");
  }

  const rating = parseInt(playerData.rating || "1000");

  await redis.pipeline()
    .hset(presenceKey, "status", "QUEUED")
    .zadd(QUEUE_KEY, rating, userId)
    .exec();

  return { message: "Joined queue", rating };
};

export const leaveQueue = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hset(presenceKey, "status", "IDLE")
    .exec();

  return { message: "Left queue" };
};