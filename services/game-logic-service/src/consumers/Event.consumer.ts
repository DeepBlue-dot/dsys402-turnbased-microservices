import { Event } from "../types/types.js";
import { gameService } from "../services/game.service.js";

export const handleEvents = async (event: Event) => {
  const { type, data } = event;

  switch (type) {
    case "match.created":
      await gameService.initializeGame(data.matchId, data.players);
      break;

    case "game.cmd.move":
      await gameService.processMove(data.matchId, data.userId, data.position);
      break;

    case "game.cmd.forfeit":
      await gameService.handleForfeit(data.matchId, data.userId);
      break;

    case "player.disconnected":
      await gameService.handlePlayerDisconnect(data.userId);
      break;
  }
};