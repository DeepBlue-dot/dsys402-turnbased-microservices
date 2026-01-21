import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";

export const startMatchmakingWorker = () => {
  console.log("[Matchmaker] Worker started (Distributed Authority Mode)...");

  setInterval(async () => {
    try {
      // 1. Get batch of candidates from the sorted set
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

        // 3. RANGE EXPANSION logic
        const joinTime = await redis.hget(JOIN_TIMES_KEY, pAId);
        const waitTimeSec = (Date.now() - parseInt(joinTime || "0")) / 1000;
        const range = waitTimeSec > 20 ? 200 : waitTimeSec > 10 ? 100 : 50;

        // 4. FIND PARTNER
        const partnerId = await findPartner(pAId, pARating, range);

        if (partnerId) {
          await createMatch(pAId, partnerId);
        }
      }
    } catch (err) {
      console.error("[Matchmaker] Worker Loop Error:", err);
    }
  }, 1500);
};

async function findPartner(id: string, rating: number, range: number) {
  const candidates = await redis.zrangebyscore(
    QUEUE_KEY, 
    rating - range, 
    rating + range, 
    "LIMIT", 0, 8
  );
  
  for (const cId of candidates) {
    if (cId === id) continue;
    
    const cData = await redis.hgetall(`presence:${cId}`);
    
    // Partner must have a live presence hash and be in QUEUED status
    if (cData && Object.keys(cData).length > 0 && cData.status === "QUEUED") {
      return cId;
    } else {
      await cleanupPlayer(cId);
    }
  }
  return null;
}

async function createMatch(p1: string, p2: string) {
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

    // 6. Notify downstream services
    await publishEvent("match.created", {
      matchId,
      players: [p1, p2],
      mode: "ranked"
    });

    console.log(`[Matchmaker] Match Created: ${p1} vs ${p2} | ID: ${matchId}`);
  } catch (err) {
    console.error("[Matchmaker] Failed to finalize match:", err);
  }
}

async function cleanupPlayer(userId: string) {
  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel(JOIN_TIMES_KEY, userId)
    .exec();
}