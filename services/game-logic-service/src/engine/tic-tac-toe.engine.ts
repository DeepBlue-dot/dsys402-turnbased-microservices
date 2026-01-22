// 1. Rename 'Symbol' to 'Piece' or 'Mark' to avoid conflict with JS built-in Symbol
export type Mark = "X" | "O";
export type Board = (Mark | "")[];

// Use Readonly to ensure these indices are never accidentally mutated
const WINNING_LINES: ReadonlyArray<number[]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export interface GameStateResult {
  status: "WIN" | "DRAW" | "ONGOING";
  winner: Mark | null;
  line: number[] | null;
}

export const ticTacToeEngine = {
  /**
   * Evaluates the board and returns a detailed state object.
   * Combining these avoids multiple redundant iterations.
   */
  getGameState(board: Board): GameStateResult {
    // Check for a winner
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      const piece = board[a];
      
      if (piece !== "" && piece === board[b] && piece === board[c]) {
        return { status: "WIN", winner: piece as Mark, line };
      }
    }

    // If no winner, check for draw (are there any empty strings left?)
    // board.includes("") is faster than board.every() because it stops at the first empty cell
    const isFull = !board.includes("");
    
    if (isFull) {
      return { status: "DRAW", winner: null, line: null };
    }

    return { status: "ONGOING", winner: null, line: null };
  },

  /**
   * Validates if a move is physically possible.
   */
  isValidMove(board: Board, position: number): boolean {
    return position >= 0 && position < 9 && board[position] === "";
  }
};