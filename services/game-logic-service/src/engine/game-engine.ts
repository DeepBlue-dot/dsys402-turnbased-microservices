import { checkWin, checkDraw } from "./win-checker.js";

export interface MoveResult {
  board: (string | null)[];
  winnerId?: string;
  draw?: boolean;
  nextTurn?: string;
}

export const applyMove = (
  game: any,
  playerId: string,
  cell: number
): MoveResult => {
  const symbol = game.symbols.get(playerId);

  // Apply move
  game.board[cell] = symbol;

  // Check win
  if (checkWin(game.board, symbol)) {
    return {
      board: game.board,
      winnerId: playerId,
    };
  }

  // Check draw
  if (checkDraw(game.board)) {
    return {
      board: game.board,
      draw: true,
    };
  }

  // Switch turn
  const nextTurn = game.players.find(
    (p: string) => p !== playerId
  );

  return {
    board: game.board,
    nextTurn,
  };
};
