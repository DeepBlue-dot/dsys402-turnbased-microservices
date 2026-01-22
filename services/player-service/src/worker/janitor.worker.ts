import { redis } from "../config/redis.js";
import { publishEvent } from "../services/rabbitmq.service.js";

const ONLINE_SET_KEY = "online_players";
const STRIKE_THRESHOLD = 4;
const JANITOR_INTERVAL = 20000;

export const startPresenceJanitor = () => {
  console.log("[Janitor] Player Service Presence Monitor started...");

  setInterval(async () => {
    let cursor = "0";
    try {
      do {
        const [nextCursor, userIds] = await redis.sscan(
          ONLINE_SET_KEY,
          cursor,
          "COUNT",
          100,
        );
        cursor = nextCursor;

        for (const userId of userIds) {
          const key = `presence:${userId}`;
          const strikes = await redis.hincrby(key, "missedHeartbeats", 1);

          if (strikes >= STRIKE_THRESHOLD) {
            console.log(`[Janitor] Evicting unresponsive player: ${userId}`);

            // 2. EMIT the event so Matchmaking and Gateway can clean up
            await publishEvent("player.disconnected", {
              userId,
            });
          }
        }
      } while (cursor !== "0");
    } catch (err) {
      console.error("[Janitor] Sweep Error:", err);
    }
  }, JANITOR_INTERVAL);
};
