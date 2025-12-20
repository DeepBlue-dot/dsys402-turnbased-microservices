import { Game } from "../models/game.model.js";
import { publish } from "../services/rabbitmq.service.js";
import { config } from "../config/env.js";

export const startPauseTimeoutWatcher = () => {
  setInterval(async () => {
    const now = new Date();

    const expired = await Game.find({
      status: "PAUSED",
      pauseUntil: { $lte: now },
    });

    for (const game of expired) {
      const winnerId = game.players.find(
        (p: string) => p !== game.pausedBy
      );

      game.status = "FINISHED";
      game.winnerId = winnerId;
      await game.save();

      await publish(config.gameEventsQueue, {
        event: "game_timeout",
        matchId: game.matchId,
        winnerId,
        reason: "disconnect_timeout",
      });

      console.log("[GameLogic] Game forfeited:", game.matchId);
    }
  }, 2000);
};
