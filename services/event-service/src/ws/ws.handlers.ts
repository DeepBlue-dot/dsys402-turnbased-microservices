import { publish } from "../services/rabbitmq.service.js";
import { config } from "../config/env.js";

export const handleClientMessage = async (
  playerId: string,
  raw: string
) => {
  const msg = JSON.parse(raw);

  switch (msg.type) {
    case "make_move":
      await publish(config.playerMoveQueue, {
        event: "player_move",
        playerId,
        matchId: msg.payload.matchId,
        move: msg.payload.move,
      });
      break;

    case "resign":
      await publish(config.gameEventsQueue, {
        event: "player_resigned",
        playerId,
        matchId: msg.payload.matchId,
      });
      break;

    case "cancel_game":
      await publish(config.gameEventsQueue, {
        event: "game_cancelled",
        playerId,
        matchId: msg.payload.matchId,
      });
      break;

    default:
      console.log("[WS] Unknown message:", msg.type);
  }
};
