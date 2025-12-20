import { redis } from "./redis.service.js";
import { config } from "../config/env.js";
import { publishMatchCreated } from "./rabbitmq.service.js";
import { v4 as uuid } from "uuid";

const LOCK_TTL = 60; // seconds
const RATING_WINDOW = 200;

export const joinMatchmaking = async (
  playerId: string,
  rating: number
) => {
  const lockKey = `${config.matchmakingLockPrefix}${playerId}`;

  const locked = await redis.setnx(lockKey, "1");
  if (!locked) {
    return { joined: false, reason: "Already in matchmaking" };
  }

  await redis.expire(lockKey, LOCK_TTL);

  const min = rating - RATING_WINDOW;
  const max = rating + RATING_WINDOW;

  const candidates = await redis.zrangebyscore(
    config.matchmakingQueue,
    min,
    max
  );

  if (candidates.length > 0) {
    const opponentId = candidates[0]; // ✅ STRING

    const tx = redis.multi();
    tx.zrem(config.matchmakingQueue, opponentId);
    tx.del(`${config.matchmakingLockPrefix}${opponentId}`);
    tx.del(lockKey);
    await tx.exec();

    const match = {
      event: "match_created",
      matchId: uuid(),
      players: [playerId, opponentId], // ✅ both strings
      createdAt: Date.now(),
    };

    await publishMatchCreated(match);
    return { matched: true, match };
  }

  await redis.zadd(
    config.matchmakingQueue,
    rating,
    playerId
  );

  return { waiting: true };
};


export const leaveQueue = async (playerId: number) => {
  const tx = redis.multi();

  // Remove from matchmaking queue
  tx.zrem(config.matchmakingQueue, playerId.toString());

  // Remove matchmaking lock (if any)
  tx.del(`${config.matchmakingLockPrefix}${playerId}`);

  await tx.exec();

  console.log(`[Matchmaking] Player ${playerId} left queue`);
};
