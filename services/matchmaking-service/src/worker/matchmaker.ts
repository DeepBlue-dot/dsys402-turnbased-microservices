import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";


export const startMatchmakingWorker = () => {
  console.log("[Matchmaker] Worker started (Distributed Authority Mode)...");

  setInterval(async () => {
    try {
      const queuedPlayers = await redis.zrange(QUEUE_KEY, 0, 40, "WITHSCORES");
      if (queuedPlayers.length < 2) return;

      for (let i = 0; i < queuedPlayers.length; i += 2) {
        const pAId = queuedPlayers[i];
        const pARating = parseFloat(queuedPlayers[i + 1]);

        const pAData = await redis.hgetall(`presence:${pAId}`);
        if (!pAData || Object.keys(pAData).length === 0 || pAData.status !== "QUEUED") {
          await cleanupPlayer(pAId);
          continue;
        }

        const joinTime = await redis.hget(JOIN_TIMES_KEY, pAId);
        const waitTimeSec = (Date.now() - parseInt(joinTime || "0")) / 1000;
        const range = waitTimeSec > 20 ? 200 : waitTimeSec > 10 ? 100 : 50;

        const partner = await findPartner(pAId, pARating, range);

        if (partner) {
          // 2. FIXED: Passing 4 arguments (id1, id2, rating1, rating2)
          await createMatch(pAId, partner.id, pARating, partner.rating);
        }
      }
    } catch (err) {
      console.error("[Matchmaker] Worker Loop Error:", err);
    }
  }, 1500);
};

/**
 * Finds a partner and returns their ID and Rating
 */
async function findPartner(id: string, rating: number, range: number): Promise<{id: string, rating: number} | null> {
  // We fetch IDs and Scores (Ratings) from Redis
  const candidates = await redis.zrangebyscore(
    QUEUE_KEY, 
    rating - range, 
    rating + range, 
    "WITHSCORES", // Crucial: get the ratings too
    "LIMIT", 0, 8
  );
  
  for (let i = 0; i < candidates.length; i += 2) {
    const cId = candidates[i];
    const cRating = parseFloat(candidates[i + 1]);

    if (cId === id) continue;
    
    const cData = await redis.hgetall(`presence:${cId}`);
    
    if (cData && Object.keys(cData).length > 0 && cData.status === "QUEUED") {
      return { id: cId, rating: cRating };
    } else {
      await cleanupPlayer(cId);
    }
  }
  return null;
}

/**
 * Handles pairing with an atomic lock and fallback rollback
 */
async function createMatch(p1: string, p2: string, r1: number, r2: number) {
  // ATOMIC LOCK
  const removedCount = await redis.zrem(QUEUE_KEY, p1, p2);
  if (removedCount !== 2) return; 

  const matchId = uuidv4();

  try {
    const [exists1, exists2] = await Promise.all([
      redis.exists(`presence:${p1}`),
      redis.exists(`presence:${p2}`)
    ]);

    const pipeline = redis.pipeline();
    if (exists1) pipeline.hset(`presence:${p1}`, "status", "IN_GAME");
    if (exists2) pipeline.hset(`presence:${p2}`, "status", "IN_GAME");
    pipeline.hdel(JOIN_TIMES_KEY, p1, p2);
    await pipeline.exec();

    // PUBLISH EVENT
    await publishEvent("match.created", {
      matchId,
      players: [p1, p2],
      mode: "ranked"
    });

    console.log(`[Matchmaker] Match Created: ${p1} vs ${p2} | ID: ${matchId}`);
  } catch (err) {
    console.error("[Matchmaker] CRITICAL: Publish Failed. Rolling back players...");

    // ROLLBACK: Put players back in queue using the r1, r2 values provided
    await redis.pipeline()
      .hset(`presence:${p1}`, "status", "QUEUED")
      .hset(`presence:${p2}`, "status", "QUEUED")
      .zadd(QUEUE_KEY, r1, p1)
      .zadd(QUEUE_KEY, r2, p2)
      .hset(JOIN_TIMES_KEY, p1, (Date.now() - 30000).toString())
      .hset(JOIN_TIMES_KEY, p2, (Date.now() - 30000).toString())
      .exec();
  }
}


async function cleanupPlayer(userId: string) {
  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel(JOIN_TIMES_KEY, userId)
    .exec();
}