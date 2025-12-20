import { consume, publish } from "../services/rabbitmq.service.js";
import { Game } from "../models/game.model.js";
import { config } from "../config/env.js";

export const startGameControlConsumer = async () => {
  await consume(config.playerMoveQueue, async (event) => {
    const { event: type } = event;

    if (type === "resign") {
      await handleResign(event);
    }

    if (type === "cancel_game") {
      await handleCancel(event);
    }
  });

  console.log("[GameLogic] Game control consumer started");
};

const handleResign = async (event: any) => {
  const { matchId, playerId } = event;

  const game = await Game.findOne({ matchId });

  if (!game) return;
  if (game.status !== "IN_PROGRESS") return;

  if (!game.players.includes(playerId)) return;

  const winnerId = game.players.find((p: string) => p !== playerId);

  game.status = "FINISHED";
  game.winnerId = winnerId;
  await game.save();

  await publish(config.gameEventsQueue, {
    event: "player_resigned",
    matchId,
    playerId,
    winnerId,
  });

  const payload = {
    event: "game_finished",
    matchId,
    winnerId,
    loserId: playerId,
    reason: "resign",
  };

  await publish(config.gameEventsQueue, payload);
  await publish(config.playerEventsQueue, payload);

  console.log("[GameLogic] Player resigned:", matchId);
};

const handleCancel = async (event: any) => {
  const { matchId, playerId } = event;

  const game = await Game.findOne({ matchId });

  if (!game) return;

  if (["FINISHED", "CANCELLED"].includes(game.status)) return;

  const hasMoves = game.board.some((cell) => cell !== null);
  if (hasMoves) return;

  game.status = "CANCELLED";
  await game.save();

  await publish(config.gameEventsQueue, {
    event: "game_cancelled",
    matchId,
    cancelledBy: playerId,
  });

  console.log("[GameLogic] Game cancelled:", matchId);
};
