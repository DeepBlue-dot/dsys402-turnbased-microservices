import { consume, publish } from "../services/rabbitmq.service.js";
import { Game } from "../models/game.model.js";
import { config } from "../config/env.js";

export const startMatchCreatedConsumer = async () => {
  await consume(config.matchCreatedQueue, async (event) => {
    const { matchId, players } = event;

    const symbols = {
      [players[0]]: "X",
      [players[1]]: "O",
    };

    const game = await Game.create({
      matchId,
      players,
      symbols,
      turn: players[0],
      status: "INITIALIZED",
    });

    await publish(config.gameEventsQueue, {
      event: "game_initialized",
      matchId,
      players,
      symbols,
      turn: game.turn,
    });

    await publish(config.gameEventsQueue, {
      event: "game_started",
      matchId,
    });

    /* ---------------- PLAYER STATUS EVENT ---------------- */

    await publish(config.playerEventsQueue, {
      event: "player_in_game",
      playerIds: players,
      matchId,
      timestamp: Date.now(),
    });

    console.log("[GameLogic] Game initialized:", matchId);
  });
};
