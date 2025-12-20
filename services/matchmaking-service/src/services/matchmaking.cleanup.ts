import { redis } from "./redis.service.js";
import { config } from "../config/env.js";

export const cleanupDisconnectedPlayer = async (playerId: number) => {
  const lockKey = `${config.matchmakingLockPrefix}${playerId}`;

  const tx = redis.multi();

  // Remove from matchmaking queue
  tx.zrem(config.matchmakingQueue, playerId.toString());

  // Remove lock
  tx.del(lockKey);

  await tx.exec();

  console.log(`[Matchmaking] Cleaned up player ${playerId}`);
};
