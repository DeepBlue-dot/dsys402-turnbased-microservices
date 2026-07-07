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
  matchId: string;
  players: string[];       // All players in the match
  winnerId: string | null; // null if draw
  reason: string;          // e.g., "DRAW", "FORFEIT", "COMPLETED"
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

    case "match.ended":
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
      data: { lastOnline: new Date() },
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
  const { players, winnerId, reason, matchId } = payload;

  // Determine loserId and isDraw for Elo calculation
  const isDraw = winnerId === null;
  const loserId = isDraw ? "" : players.find((id) => id !== winnerId)!;

  try {
    const results = await prisma.$transaction(async (tx) => {
      // Find current stats of all players
      const playerStatsList = await Promise.all(
        players.map((pid) => tx.playerStats.findUnique({ where: { playerId: pid } }))
      );

      if (playerStatsList.some((s) => !s)) {
        throw new Error("Stats not found for one or more players");
      }

      const statsMap = new Map(playerStatsList.map((s) => [s!.playerId, s!]));

      const p1Id = players[0];
      const p2Id = players[1];
      const p1Stats = statsMap.get(p1Id)!;
      const p2Stats = statsMap.get(p2Id)!;

      if (!isDraw) {
        const isP1Winner = winnerId === p1Id;
        const winnerStats = isP1Winner ? p1Stats : p2Stats;
        const loserStats = isP1Winner ? p2Stats : p1Stats;

        const ratings = calculateElo(winnerStats.rating, loserStats.rating);

        await Promise.all([
          tx.playerStats.update({
            where: { playerId: winnerId! },
            data: { wins: { increment: 1 }, rating: ratings.winnerNewRating },
          }),
          tx.playerStats.update({
            where: { playerId: loserId },
            data: { losses: { increment: 1 }, rating: ratings.loserNewRating },
          }),
        ]);

        return {
          p1NewRating: isP1Winner ? ratings.winnerNewRating : ratings.loserNewRating,
          p1OldRating: p1Stats.rating,
          p2NewRating: isP1Winner ? ratings.loserNewRating : ratings.winnerNewRating,
          p2OldRating: p2Stats.rating,
        };
      } else {
        // Draw: increment draws for all players
        await tx.playerStats.updateMany({
          where: { playerId: { in: players } },
          data: { draws: { increment: 1 } },
        });

        return {
          p1NewRating: p1Stats.rating,
          p1OldRating: p1Stats.rating,
          p2NewRating: p2Stats.rating,
          p2OldRating: p2Stats.rating,
        };
      }
    });

    const p1Id = players[0];
    const p2Id = players[1];

    const syncRedisAndPublish = async (id: string, newRating: number, ratingChange: number) => {
      const key = `presence:${id}`;
      let instanceId: string | null = null;
      if (await redis.exists(key)) {
        const fields = await redis.hmget(key, "instanceId");
        instanceId = fields[0];
        await redis.hset(key, {
          rating: newRating.toString(),
          status: "IDLE",
        });
      }
      if (instanceId) {
        await publishEvent(`player.rating.updated.${instanceId}`, {
          recipientId: id,
          matchId,
          ratingChange,
          newRating,
        });
      }
    };

    await Promise.all([
      syncRedisAndPublish(p1Id, results.p1NewRating, results.p1NewRating - results.p1OldRating),
      syncRedisAndPublish(p2Id, results.p2NewRating, results.p2NewRating - results.p2OldRating),
    ]);
  } catch (err) {
    console.error("[Match] Transaction failed:", err);
    throw err;
  }
};
