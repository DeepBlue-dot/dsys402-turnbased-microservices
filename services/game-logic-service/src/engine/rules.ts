import { ValidationResult } from "./types.js";
import { Game } from "../models/game.model.js";

export const validateMove = (
  game: any,
  playerId: string,
  cell: number
): ValidationResult => {
  if (!game) {
    return { valid: false, reason: "GAME_NOT_FOUND" };
  }

  if (game.status !== "IN_PROGRESS") {
    return { valid: false, reason: "GAME_NOT_ACTIVE" };
  }

  if (!game.players.includes(playerId)) {
    return { valid: false, reason: "PLAYER_NOT_IN_GAME" };
  }

  if (game.turn !== playerId) {
    return { valid: false, reason: "NOT_YOUR_TURN" };
  }

  if (cell < 0 || cell > 8) {
    return { valid: false, reason: "CELL_OUT_OF_RANGE" };
  }

  if (game.board[cell] !== null) {
    return { valid: false, reason: "CELL_OCCUPIED" };
  }

  return { valid: true };
};
