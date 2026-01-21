import { redis } from "../config/redis.js";
import { publishMatchCreated } from "../services/rabbitmq.service.js"; // You'll need this
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "match:queue:ranked";
const ELO_RANGE = 50; // Initial search range

export const startMatchmakingWorker = () => {
  console.log("[Matchmaker] Worker started...");

  // Poll more frequently (every 1s) to make the game feel responsive
  setInterval(async () => {
    try {
      const queuedPlayers = await redis.zrange(QUEUE_KEY, 0, 50, "WITHSCORES");
      
      if (queuedPlayers.length < 2) return;

      for (let i = 0; i < queuedPlayers.length; i += 2) {
        const playerAId = queuedPlayers[i];
        const playerARating = parseFloat(queuedPlayers[i + 1]);

        const partnerId = await findPartner(playerAId, playerARating);

        if (partnerId) {
          await createMatch(playerAId, partnerId);
        }
      }
    } catch (err) {
      console.error("[Matchmaker] Worker Error:", err);
    }
  }, 1000); 
};

/**
 * Finds a partner within ELO range who isn't the player themselves
 */
async function findPartner(playerId: string, rating: number): Promise<string | null> {
  const neighbors = await redis.zrangebyscore(
    QUEUE_KEY,
    rating - ELO_RANGE,
    rating + ELO_RANGE,
    "LIMIT", 0, 5 
  );

  return neighbors.find(id => id !== playerId) || null;
}

/**
 * Atomically creates the match and notifies the system
 */
async function createMatch(p1: string, p2: string) {
  const matchId = uuidv4();

  const removedCount = await redis.zrem(QUEUE_KEY, p1, p2);

  if (removedCount !== 2) return;

  try {
    console.log(`[Matchmaker] Match Created: ${p1} vs ${p2} (ID: ${matchId})`);

    await redis.pipeline()
      .hset(`presence:${p1}`, "status", "IN_GAME")
      .hset(`presence:${p2}`, "status", "IN_GAME")
      .exec();

    await publishMatchCreated({
      matchId,
      players: [p1, p2],
    });

  } catch (err) {
    console.error("[Matchmaker] Failed to finalize match:", err);
  }
}