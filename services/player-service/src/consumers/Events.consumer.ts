import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";

const ONLINE_SET_KEY = "online_players";

// Types
interface PlayerConnectedPayload {
  userId: string;
  instanceId: string;
}
interface MatchEndedPayload {
  winnerId: string;
  loserId: string;
  isDraw: boolean;
}

const calculateElo = (winnerRating: number, loserRating: number) => {
  const K = 32;
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser =
    1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  return {
    winnerNewRating: Math.round(winnerRating + K * (1 - expectedWinner)),
    loserNewRating: Math.round(loserRating + K * (0 - expectedLoser)),
  };
};

/**
 * Main Event Discriminator
 */
export const handleEvents = async (event: {
  type: string;
  data: any;
  occurredAt: string;
}) => {
  switch (event.type) {
    case "player.connected":
      await handlePlayerConnected(event.data);
      break;

    case "player.disconnected":
      await handlePlayerDisconnected(event.data);
      break;

    case "player.heartbeat":
      await handlePlayerHeartbeat(event.data);
      break;

    case "game.ended":
      await handleMatchEnded(event.data);
      break;

    default:
      console.warn(`[PlayerService] Unhandled event type: ${event.type}`);
  }
};

const handlePlayerHeartbeat = async (payload: { userId: string }) => {
  try {
    const isOnline = await redis.sismember(ONLINE_SET_KEY, payload.userId);
    if (isOnline) {
      await redis.hset(`presence:${payload.userId}`, "missedHeartbeats", "0");
    }
  } catch (error) {
    console.error(`[Presence] Heartbeat error for ${payload.userId}:`, error);
  }
};

/**
 * Handle Connection: Fetch from DB and Prime Redis
 */
const handlePlayerConnected = async (payload: PlayerConnectedPayload) => {
  const { userId, instanceId } = payload;
  const key = `presence:${userId}`;

  try {
    const existingStatus = await redis.hget(key, "status");

    const player = await prisma.player.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: { select: { username: true } },
        stats: { select: { rating: true } },
      },
    });

    if (!player) return;

    const pipeline = redis.pipeline();

    const statusToSet =
      existingStatus === "IN_GAME" || existingStatus === "QUEUED"
        ? existingStatus
        : "IDLE";

    pipeline.hset(key, {
      userId,
      rating: player.stats?.rating?.toString() || "0",
      status: statusToSet,
      instanceId,
      missedHeartbeats: "0",
    });

    pipeline.sadd("online_players", userId);
    await pipeline.exec();

    console.log(`[Presence] ${player.profile?.username} is now IDLE`);
  } catch (error) {
    console.error(`[Presence] Error connecting ${userId}:`, error);
  }
};

/**
 * Handle Disconnection: Clean Redis and Update DB
 */
const handlePlayerDisconnected = async (payload: { userId: string }) => {
  const { userId } = payload;
  const key = `presence:${userId}`;

  try {
    // 1. Atomic Redis Cleanup
    await redis.pipeline().del(key).srem(ONLINE_SET_KEY, userId).exec();

    // 2. Persist "Last Seen" to PostgreSQL
    await prisma.player.update({
      where: { id: userId },
      data: { updatedAt: new Date() },
    });

    console.log(`[Presence] ${userId} disconnected and archived`);
  } catch (error) {
    console.error(`[Presence] Error disconnecting ${userId}:`, error);
  }
};

/**
 * Handle Match Result: Update DB and Sync Redis
 */
const handleMatchEnded = async (payload: MatchEndedPayload) => {
  const { winnerId, loserId, isDraw } = payload;

  try {
    const results = await prisma.$transaction(async (tx) => {
      const [winnerStats, loserStats] = await Promise.all([
        tx.playerStats.findUnique({ where: { playerId: winnerId } }),
        tx.playerStats.findUnique({ where: { playerId: loserId } }),
      ]);

      if (!winnerStats || !loserStats) throw new Error("Stats not found");

      let winnerNewRating = winnerStats.rating;
      let loserNewRating = loserStats.rating;

      if (isDraw) {
        await tx.playerStats.updateMany({
          where: { playerId: { in: [winnerId, loserId] } },
          data: { draws: { increment: 1 } },
        });
      } else {
        const ratings = calculateElo(winnerStats.rating, loserStats.rating);
        winnerNewRating = ratings.winnerNewRating;
        loserNewRating = ratings.loserNewRating;

        await tx.playerStats.update({
          where: { playerId: winnerId },
          data: { wins: { increment: 1 }, rating: winnerNewRating },
        });

        await tx.playerStats.update({
          where: { playerId: loserId },
          data: { losses: { increment: 1 }, rating: loserNewRating },
        });
      }

      return { winnerNewRating, loserNewRating };
    });

    // --- Conditional Redis Update ---
    const syncRedis = async (id: string, newRating: number) => {
      const key = `presence:${id}`;
      if (await redis.exists(key)) {
        await redis.hset(key, {
          rating: newRating.toString(),
          status: "IDLE", // Match ended, move back from IN_GAME
        });
      }
    };

    await Promise.all([
      syncRedis(winnerId, results.winnerNewRating),
      syncRedis(loserId, results.loserNewRating),
    ]);
  } catch (err) {
    console.error("[Match] Transaction failed:", err);
    throw err;
  }
};
