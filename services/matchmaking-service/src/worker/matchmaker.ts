import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";
const USER_LOCATION_KEY = (userId: string) => `user:location:${userId}`;



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
 */async function createMatch(p1: string, p2: string, r1: number, r2: number) {
  // 1. ATOMIC LOCK: Remove both players from the Sorted Set queue
  // If this returns < 2, another worker instance already matched one of these players
  const removedCount = await redis.zrem(QUEUE_KEY, p1, p2);
  if (removedCount !== 2) return;

  const matchId = uuidv4();

  try {
    // 2. FETCH TARGET LOCATIONS (Now inside the presence hash)
    const [p1Data, p2Data] = await Promise.all([
      redis.hgetall(`presence:${p1}`),
      redis.hgetall(`presence:${p2}`)
    ]);

    const pipeline = redis.pipeline();

    // 3. STATUS UPDATES
    // We only update status if the presence hash still exists (Object.keys check)
    const p1Exists = p1Data && Object.keys(p1Data).length > 0;
    const p2Exists = p2Data && Object.keys(p2Data).length > 0;

    if (p1Exists) pipeline.hset(`presence:${p1}`, "status", "IN_GAME");
    if (p2Exists) pipeline.hset(`presence:${p2}`, "status", "IN_GAME");
    
    pipeline.hdel(JOIN_TIMES_KEY, p1, p2);
    await pipeline.exec();

    // 4. TARGETED PUBLISHING
    // We send the 'match.created' event ONLY to the specific Gateway instances 
    // where these players are physically connected.
    const instance1 = p1Data.instanceId;
    const instance2 = p2Data.instanceId;

    if (instance1) {
      await publishEvent(`match.created.${instance1}`, {
        matchId,
        players: [p1, p2],
        mode: "ranked"
      });
    }

    // Only send a second event if the players are on DIFFERENT instances
    if (instance2 && instance2 !== instance1) {
      await publishEvent(`match.created.${instance2}`, {
        matchId,
        players: [p1, p2],
        mode: "ranked"
      });
    }

    console.log(`[Matchmaker] Success: ${matchId} | Instances: ${instance1}, ${instance2}`);

  } catch (err) {
    console.error("[Matchmaker] CRITICAL: Match finalization failed. Rolling back players to queue...");

    // 5. THE ROLLBACK
    // If RabbitMQ fails or Redis errors out, we must put them back in the queue
    // using the original ratings (r1, r2) provided by the worker loop.
    await redis.pipeline()
      .hset(`presence:${p1}`, "status", "QUEUED")
      .hset(`presence:${p2}`, "status", "QUEUED")
      .zadd(QUEUE_KEY, r1, p1)
      .zadd(QUEUE_KEY, r2, p2)
      .hset(JOIN_TIMES_KEY, p1, (Date.now() - 30000).toString()) // Re-queue at the front
      .hset(JOIN_TIMES_KEY, p2, (Date.now() - 30000).toString())
      .exec();
  }
}

/**
 * Basic cleanup for matchmaking data structures
 */
async function cleanupPlayer(userId: string) {
  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel(JOIN_TIMES_KEY, userId)
    .exec();
}