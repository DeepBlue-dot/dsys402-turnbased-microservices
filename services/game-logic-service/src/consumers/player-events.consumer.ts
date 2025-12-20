import { consume, publish } from "../services/rabbitmq.service.js";
import { Game } from "../models/game.model.js";
import { config } from "../config/env.js";

export const startPlayerEventsConsumer = async () => {
  await consume(config.playerEventsQueue, async (event) => {
    const { event: type, playerId } = event;

    if (type === "player_disconnected") {
      await handleDisconnect(playerId);
    }

    if (type === "player_reconnected" || type === "player_connected" ) {
      await handleReconnect(playerId);
    }
  });

  console.log("[GameLogic] Player events consumer running");
};

const handleDisconnect = async (playerId: string) => {
  const game = await Game.findOne({
    players: playerId,
    status: "IN_PROGRESS",
  });

  if (!game) return;

  game.status = "PAUSED";
  game.pausedBy = playerId;
  game.pauseUntil = new Date(Date.now() + config.disconnectGraceMs);

  await game.save();

  await publish(config.gameEventsQueue, {
    event: "game_paused",
    matchId: game.matchId,
    pausedBy: playerId,
    resumeBy: game.pauseUntil,
  });

  console.log("[GameLogic] Game paused:", game.matchId);
};

const handleReconnect = async (playerId: string) => {
  const game = await Game.findOne({
    players: playerId,
    status: "PAUSED",
    pausedBy: playerId,
  });

  if (!game) return;

  game.status = "IN_PROGRESS";
  game.pausedBy = undefined;
  game.pauseUntil = undefined;

  await game.save();

  await publish(config.gameEventsQueue, {
    event: "game_resumed",
    matchId: game.matchId,
  });

  await publish(config.gameEventsQueue, {
    event: "state_sync",
    matchId: game.matchId,
    playerId,
    board: game.board,
    turn: game.turn,
    symbols: Object.fromEntries(game.symbols ?? []),
    status: game.status,
  });

  console.log("[GameLogic] Game resumed:", game.matchId);
};
