import { consume, publish } from "../services/rabbitmq.service.js";
import { Game } from "../models/game.model.js";
import { validateMove } from "../engine/rules.js";
import { applyMove } from "../engine/game-engine.js";
import { config } from "../config/env.js";

export const startPlayerMoveConsumer = async () => {
  await consume(config.playerMoveQueue, async (event) => {
    const { matchId, playerId, cell } = event;

    const game = await Game.findOne({ matchId });

    if (!game) {
      await publish(config.gameEventsQueue, {
        event: "invalid_move",
        matchId,
        playerId,
        reason: "GAME_NOT_FOUND",
      });
      return;
    }

    const validation = validateMove(game, playerId, cell);
    if (!validation.valid) {
      await publish(config.gameEventsQueue, {
        event: "invalid_move",
        matchId,
        playerId,
        reason: validation.reason,
      });
      return;
    }

    const result = applyMove(game, playerId, cell);

    if (result.winnerId) {
      game.status = "FINISHED";
      game.winnerId = result.winnerId;
      await game.save();

      const loserId = game.players.find((p: string) => p !== result.winnerId);

      const payload = {
        event: "game_finished",
        matchId,
        winnerId: result.winnerId,
        loserId,
        reason: "normal",
      };

      await publish(config.gameEventsQueue, {
        ...payload,
        board: game.board,
      });

      await publish(config.playerEventsQueue, payload);

      return;
    }

    if (result.draw) {
      game.status = "FINISHED";
      await game.save();

      const payload = {
        event: "game_finished",
        matchId,
        draw: true,
        reason: "draw",
      };

      await publish(config.gameEventsQueue, {
        ...payload,
        board: game.board,
      });

      await publish(config.playerEventsQueue, payload);
      return;
    }

    game.turn = result.nextTurn;
    await game.save();

    await publish(config.gameEventsQueue, {
      event: "turn_completed",
      matchId,
      playerId,
      cell,
      board: game.board,
      nextTurn: result.nextTurn,
    });
  });
};
