import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";

const PRESENCE_TTL = 60;

interface PlayerConnectedPayload {
  userId: string;
  username: string;
  rating: number;
}

interface PlayerHeartbeatPayload {
  userId: string;
}

interface MatchEndedPayload {
  winnerId: string;
  loserId: string;
  isDraw: boolean;
}

interface Event<T = any> {
  type: string;
  payload: T;
}

const calculateElo = (winnerRating: number, loserRating: number) => {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  return {
    winnerNewRating: Math.round(winnerRating + K * (1 - expectedWinner)),
    loserNewRating: Math.round(loserRating + K * (0 - expectedLoser)),
  };
};

export const handleEvents = async (event: Event) => {
  switch (event.type) {
    case "player.connected":
      await handlePlayerConnected(event.payload as PlayerConnectedPayload);
      break;

    case "player.heartbeat":
      await handlePlayerHeartbeat(event.payload as PlayerHeartbeatPayload);
      break;

    case "match.ended":
      await handleMatchEnded(event.payload as MatchEndedPayload);
      break;
  }
};

const handlePlayerConnected = async (payload: PlayerConnectedPayload) => {
  const { userId, username, rating } = payload;
  const key = `presence:${userId}`;

  await redis.hset(key, {
    userId,
    username,
    rating: rating.toString(),
    status: "IDLE",
    lastPulse: Date.now().toString(),
  });

  await redis.expire(key, PRESENCE_TTL);
  console.log(`[Presence] Player ${username} online (TTL 60s)`);
};

const handlePlayerHeartbeat = async (payload: PlayerHeartbeatPayload) => {
  const { userId } = payload;
  const key = `presence:${userId}`;

  if (await redis.exists(key)) {
    await redis.hset(key, "lastPulse", Date.now().toString());
    await redis.expire(key, PRESENCE_TTL);
  }
};

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

    const updateRedis = async (id: string, newRating: number) => {
      const key = `presence:${id}`;
      if (await redis.exists(key)) {
        await redis.hset(key, {
          rating: newRating.toString(),
          status: "IDLE",
        });
        await redis.expire(key, PRESENCE_TTL);
      }
    };

    await Promise.all([
      updateRedis(winnerId, results.winnerNewRating),
      updateRedis(loserId, results.loserNewRating),
    ]);

  } catch (err) {
    console.error("[PlayerService] Transaction failed:", err);
    throw err;
  }
};
