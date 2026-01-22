import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";

export const joinMatchmaking = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  // 1. Fetch live presence data (including instanceId for targeted routing)
  const playerData = await redis.hgetall(presenceKey);

  if (!playerData || Object.keys(playerData).length === 0) {
    throw new Error("Presence not found. Please ensure your game is connected.");
  }

  if (playerData.status === "QUEUED") {
    throw new Error("You are already searching for a match.");
  }

  if (playerData.status === "IN_GAME") {
    throw new Error("Cannot queue while in an active match.");
  }

  const rating = parseInt(playerData.rating || "1000");
  const instanceId = playerData.instanceId; // 🔑 Found the Gateway location

  // 2. ATOMIC PIPELINE: Update Redis State
  await redis.pipeline()
    .hset(presenceKey, "status", "QUEUED")
    .zadd(QUEUE_KEY, rating, userId)
    .hset(JOIN_TIMES_KEY, userId, Date.now().toString())
    .exec();

  // 3. TARGETED PUBLISH: Only the specific Gateway instance notifies the player
  if (instanceId) {
    await publishEvent(`matchmaking.joined.${instanceId}`, {
      userId,
      rating,
      queue: "ranked",
    });
  }

  console.log(`[Matchmaking] Player ${userId} joined queue on ${instanceId}`);
  return { message: "Joined queue", rating };
};

export const leaveQueue = async (userId: string) => {
  const presenceKey = `presence:${userId}`;

  // Fetch presence to get status and instanceId
  const playerData = await redis.hgetall(presenceKey);

  if (!playerData || Object.keys(playerData).length === 0) {
    console.warn(`[Matchmaking] Player ${userId} is offline, cannot leave queue.`);
    return { message: "Player offline" };
  }

  const currentStatus = playerData.status;
  const instanceId = playerData.instanceId;

  if (currentStatus !== "QUEUED") {
    console.warn(`[Matchmaking] Player ${userId} is not in queue.`);
    return { message: "Player not in queue" };
  }

  // 1. ATOMIC PIPELINE: Cleanup Matchmaking Data
  const pipeline = redis.pipeline();
  pipeline.zrem(QUEUE_KEY, userId);
  pipeline.hdel(JOIN_TIMES_KEY, userId);
  pipeline.hset(presenceKey, "status", "IDLE"); // Set back to idle
  await pipeline.exec();

  // 2. TARGETED PUBLISH: Notify the specific Gateway to update the player's UI
  if (instanceId) {
    await publishEvent(`matchmaking.left.${instanceId}`, {
      userId,
      queue: "ranked",
    });
  }

  console.log(`[Matchmaking] Player ${userId} left queue from ${instanceId}`);
  return { message: "Left queue" };
};
