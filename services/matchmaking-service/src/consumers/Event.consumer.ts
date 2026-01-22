import { redis } from "../config/redis.js";
import { PlayerDisconnectedData, Event } from "../types/types.js";

export const handleEvents = async (event: Event) => {
  switch (event.type) {
    case "player.disconnected":
      await handlePlayerDisconnected(event.data as PlayerDisconnectedData);
      break;
    case "match.failed":
      await handleMatchFailed(event.data);
      break;
  }
};

export const handlePlayerDisconnected = async (
  payload: PlayerDisconnectedData,
) => {
  const { userId } = payload;
  console.log(`[Matchmaking] Cleaning up queue for ${userId}`);

  const QUEUE_KEY = "match:queue:ranked";
  const JOIN_TIMES_KEY = "match:join_times";

  await redis
    .pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel(JOIN_TIMES_KEY, userId)
    .exec();
};

const handleMatchFailed = async (payload: {
  players: string[];
  reason: string;
}) => {
  console.log(
    `[Matchmaking] Match failed: ${payload.reason}. Re-queuing players...`,
  );

  const QUEUE_KEY = "match:queue:ranked";
  const JOIN_TIMES_KEY = "match:join_times";

  for (const userId of payload.players) {
    const presenceKey = `presence:${userId}`;
    const playerData = await redis.hgetall(presenceKey);

    // Only re-queue if the player is still physically online
    if (playerData && Object.keys(playerData).length > 0) {
      const rating = parseInt(playerData.rating || "1000");

      await redis
        .pipeline()
        .hset(presenceKey, "status", "QUEUED")
        .zadd(QUEUE_KEY, rating, userId)
        // Give them a "bonus" timestamp (30s ago) so they stay at the head of the queue
        .hset(JOIN_TIMES_KEY, userId, (Date.now() - 30000).toString())
        .exec();

      console.log(`[Matchmaking] Player ${userId} successfully re-queued.`);
    }
  }
};
