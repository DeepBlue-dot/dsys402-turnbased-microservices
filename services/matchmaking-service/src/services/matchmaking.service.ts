import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";

export const joinMatchmaking = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  // 1. Fetch live presence data
  const playerData = await redis.hgetall(presenceKey);

  // If the hash is empty, the player has no active connection (Gateway/Janitor deleted it)
  if (!playerData || Object.keys(playerData).length === 0) {
    throw new Error("Presence not found. Please ensure your game is connected.");
  }

  // 2. Validate current status
  if (playerData.status === "QUEUED") {
    throw new Error("You are already searching for a match.");
  }

  if (playerData.status === "IN_GAME") {
    throw new Error("Cannot queue while in an active match.");
  }

  const rating = parseInt(playerData.rating || "1000");

  // 3. ATOMIC PIPELINE: Update Status, Add to Queue, and Set Join Time
  await redis.pipeline()
    .hset(presenceKey, "status", "QUEUED")
    .zadd(QUEUE_KEY, rating, userId)
    .hset(JOIN_TIMES_KEY, userId, Date.now().toString())
    .exec();

  // 4. Notify the system
  await publishEvent("matchmaking.joined", {
    userId,
    rating,
    queue: "ranked",
  });

  console.log(`[Matchmaking] Player ${userId} joined queue (ELO: ${rating})`);
  return { message: "Joined queue", rating };
};

export const leaveQueue = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  // Check if they are actually in the queue before resetting status
  const currentStatus = await redis.hget(presenceKey, "status");

  // 1. ATOMIC PIPELINE: Cleanup Matchmaking Data
  const pipeline = redis.pipeline();
  pipeline.zrem(QUEUE_KEY, userId);
  pipeline.hdel(JOIN_TIMES_KEY, userId);


  if (currentStatus === "QUEUED") {
    pipeline.hset(presenceKey, "status", "IDLE");
  }

  await pipeline.exec();

  // 2. Notify the system
  await publishEvent("matchmaking.left", {
    userId,
    queue: "ranked",
  });

  console.log(`[Matchmaking] Player ${userId} left queue`);
  return { message: "Left queue" };
};