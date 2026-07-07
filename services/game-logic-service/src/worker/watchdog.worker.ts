import { redis } from "../config/redis.js";
import { gameService } from "../services/game.service.js";
import { config } from "../config/env.js";
import { publishEvent } from "../services/rabbitmq.service.js";

const TIMERS_KEY = "game:timers";

export const startWatchdog = () => {
  console.log(`[Watchdog] Timer monitor started (Interval: ${config.watchdogIntervalMs}ms)`);

  setInterval(async () => {
    try {
      const now = Date.now();

      // 1. Find matches that have passed their deadline
      // We look for scores between 0 and 'now'
      const expiredMatchIds = await redis.zrangebyscore(TIMERS_KEY, 0, now, "LIMIT", 0, 10);

      for (const matchId of expiredMatchIds) {
        // 2. ATOMIC CLAIM: Try to remove the matchId from the timer set
        // If zrem returns 1, this specific server instance "won" the right to handle the timeout.
        // This prevents multiple instances from forfeiting the same match.
        const claimed = await redis.zrem(TIMERS_KEY, matchId);

        if (claimed === 1) {
          console.log(`[Watchdog] Match ${matchId} timed out. Processing forfeit...`);
          await handleTimeout(matchId);
        }
      }

      // 3. Find rematches that have passed their deadline
      const expiredRematchIds = await redis.zrangebyscore("rematch:timers", 0, now, "LIMIT", 0, 10);

      for (const matchId of expiredRematchIds) {
        const claimed = await redis.zrem("rematch:timers", matchId);

        if (claimed === 1) {
          console.log(`[Watchdog] Rematch for match ${matchId} timed out. Expiring request...`);
          await handleRematchTimeout(matchId);
        }
      }
    } catch (err) {
      console.error("[Watchdog] Error in loop:", err);
    }
  }, config.watchdogIntervalMs);
};

/**
 * Identify who was supposed to move and forfeit them
 */
async function handleTimeout(matchId: string) {
  const state = await redis.hgetall(`game:match:${matchId}`);
  if (!state || Object.keys(state).length === 0) return;

  const players: string[] = JSON.parse(state.players);
  const timedOutUserId = state.turn;
  const winnerId = players.find(id => id !== timedOutUserId) || null;
  const board = JSON.parse(state.board);

  // Archive the game as a TIMEOUT
  await gameService.endGame(matchId, board, winnerId, "TIMEOUT");
}

/**
 * Handle rematch request expiration
 */
async function handleRematchTimeout(matchId: string) {
  const key = `game:rematch:${matchId}`;
  const rematch = await redis.hgetall(key);
  if (!rematch || Object.keys(rematch).length === 0) return;

  const players: string[] = JSON.parse(rematch.players);

  // Delete from Redis
  await redis.del(key);

  const locations = await Promise.all(
    players.map((id) => gameService.getPlayerLocation(id))
  );

  for (const loc of locations) {
    if (loc) {
      await publishEvent(`game.event.rematch_expired.${loc.instanceId}`, {
        recipientId: loc.userId,
        matchId,
      });
    }
  }
}