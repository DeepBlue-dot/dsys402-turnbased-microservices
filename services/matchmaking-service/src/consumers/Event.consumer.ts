import { redis } from "../config/redis.js";
import { PlayerDisconnectedData, Event } from "../types/types.js";

export const handleEvents = async (event: Event) => {
  switch (event.type) {
    case "player.disconnected":
      await handlePlayerDisconnected(event.data as PlayerDisconnectedData);
      break;
  }
};

export const handlePlayerDisconnected = async (payload: PlayerDisconnectedData) => {
  const { userId } = payload;
  console.log(`[Matchmaking] Cleaning up queue for ${userId}`);

  const QUEUE_KEY = "match:queue:ranked";
  const JOIN_TIMES_KEY = "match:join_times";

  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel(JOIN_TIMES_KEY, userId)
    .exec();
};