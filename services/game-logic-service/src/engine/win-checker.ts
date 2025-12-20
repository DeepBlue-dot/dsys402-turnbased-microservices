const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const checkWin = (
  board: (string | null)[],
  symbol: string
): boolean => {
  return WIN_PATTERNS.some(pattern =>
    pattern.every(index => board[index] === symbol)
  );
};

export const checkDraw = (board: (string | null)[]): boolean => {
  return board.every(cell => cell !== null);
};
