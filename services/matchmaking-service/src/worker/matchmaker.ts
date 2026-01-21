// worker/matchmaker.ts
import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "match:queue:ranked";

export const startMatchmakingWorker = () => {
  console.log("[Matchmaker] Worker started...");

  setInterval(async () => {
    try {
      const queuedPlayers = await redis.zrange(QUEUE_KEY, 0, 40, "WITHSCORES");
      if (queuedPlayers.length < 2) return;

      for (let i = 0; i < queuedPlayers.length; i += 2) {
        const pAId = queuedPlayers[i];
        const pARating = parseFloat(queuedPlayers[i + 1]);

        // 1. GHOST CHECK: Verify Player A is still online/queued
        const pAStatus = await redis.hget(`presence:${pAId}`, "status");
        if (pAStatus !== "QUEUED") {
          await cleanupPlayer(pAId);
          continue;
        }

        // 2. RANGE EXPANSION: Calculate how long they've been waiting
        const joinTime = await redis.hget("match:join_times", pAId);
        const waitTimeSec = (Date.now() - parseInt(joinTime || "0")) / 1000;
        
        // Expand range: ±50 (0s), ±100 (10s), ±200 (20s)
        const range = waitTimeSec > 20 ? 200 : waitTimeSec > 10 ? 100 : 50;

        // 3. FIND PARTNER
        const partnerId = await findPartner(pAId, pARating, range);

        if (partnerId) {
          await createMatch(pAId, partnerId);
        }
      }
    } catch (err) {
      console.error("[Matchmaker] Worker Error:", err);
    }
  }, 1500);
};

async function findPartner(id: string, rating: number, range: number) {
  const candidates = await redis.zrangebyscore(QUEUE_KEY, rating - range, rating + range, "LIMIT", 0, 5);
  
  for (const cId of candidates) {
    if (cId === id) continue;
    
    // Ensure Candidate is actually still QUEUED
    const status = await redis.hget(`presence:${cId}`, "status");
    if (status === "QUEUED") return cId;
    
    // If not queued, they are a 'Ghost', clean them up
    await cleanupPlayer(cId);
  }
  return null;
}

async function createMatch(p1: string, p2: string) {
  // ATOMIC LOCK: Try to grab both players
  const removed = await redis.zrem(QUEUE_KEY, p1, p2);
  if (removed !== 2) return; // Someone else got them first

  const matchId = uuidv4();
  try {
    await redis.pipeline()
      .hset(`presence:${p1}`, "status", "IN_GAME")
      .hset(`presence:${p2}`, "status", "IN_GAME")
      .hdel("match:join_times", p1, p2) // Remove timestamps
      .exec();

    await publishEvent("match.created", { matchId, players: [p1, p2] });
    console.log(`[Matchmaker] Match Created: ${matchId}`);
  } catch (err) {
    console.error("Match finalize failed", err);
  }
}

async function cleanupPlayer(userId: string) {
  await redis.pipeline()
    .zrem(QUEUE_KEY, userId)
    .hdel("match:join_times", userId)
    .exec();
}