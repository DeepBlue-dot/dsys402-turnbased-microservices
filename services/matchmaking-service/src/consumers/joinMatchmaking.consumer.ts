import { consume } from "../services/rabbitmq.service.js";
import { cleanupDisconnectedPlayer } from "../services/matchmaking.cleanup.js";
import { config } from "../config/env.js";

export const startPlayerEventsConsumer = async () => {
  await consume(config.playerEventsQueue, async (event) => {
    if (event.event === "player_disconnected") {
      await cleanupDisconnectedPlayer(event.playerId);
    }
  });

  console.log("[Matchmaking] Player events consumer started");
};
