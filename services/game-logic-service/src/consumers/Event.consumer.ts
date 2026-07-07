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

    case "game.cmd.draw_propose":
      await gameService.handleDrawPropose(data.matchId, data.userId);
      break;

    case "game.cmd.draw_confirm":
      await gameService.handleDrawConfirm(data.matchId, data.userId);
      break;

    case "game.cmd.draw_decline":
      await gameService.handleDrawDecline(data.matchId, data.userId);
      break;

    case "game.cmd.rematch_request":
      await gameService.handleRematchRequest(data.matchId, data.userId);
      break;

    case "game.cmd.rematch_decline":
      await gameService.handleRematchDecline(data.matchId, data.userId);
      break;

    case "player.disconnected":
      await gameService.handlePlayerDisconnect(data.userId);
      break;
  }
};