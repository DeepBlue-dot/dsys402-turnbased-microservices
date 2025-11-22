/**
 * Tic-Tac-Toe Game Logic Service
 * A pure, stateless game engine with complete rule enforcement
 */

class TicTacToeGame {
  constructor() {
    this.winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
  }

  /**
   * Create a new game state
   * @returns {Object} Initial game state
   */
  createGame(players = { playerX: null, playerO: null }) {
    return {
      gameId: this._generateGameId(),
      players,
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'playing', // waiting, playing, finished, abandoned
      winner: null,
      moveHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Validate if a move is legal
   * @param {Object} gameState - Current game state
   * @param {number} position - Board position (0-8)
   * @param {string} player - Player making the move ('X' or 'O')
   * @returns {Object} Validation result
   */
  isValidMove(gameState, position, player) {
    // Basic validation
    if (!gameState) {
      return { valid: false, reason: "Game state is required" };
    }

    if (typeof position !== 'number' || position < 0 || position > 8) {
      return { valid: false, reason: "Position must be a number between 0-8" };
    }

    if (!['X', 'O'].includes(player)) {
      return { valid: false, reason: "Player must be 'X' or 'O'" };
    }

    // Game status validation
    if (gameState.status !== 'playing') {
      return { valid: false, reason: `Game is ${gameState.status}` };
    }

    // Turn validation
    if (gameState.currentPlayer !== player) {
      return { valid: false, reason: "Not your turn" };
    }

    // Position availability
    if (gameState.board[position] !== null) {
      return { valid: false, reason: "Position already occupied" };
    }

    return { valid: true };
  }

  /**
   * Execute a move and return updated game state
   * @param {Object} gameState - Current game state
   * @param {number} position - Board position (0-8)
   * @param {string} player - Player making the move
   * @returns {Object} Updated game state
   */
  makeMove(gameState, position, player) {
    // Validate the move first
    const validation = this.isValidMove(gameState, position, player);
    if (!validation.valid) {
      throw new Error(`Invalid move: ${validation.reason}`);
    }

    // Create a deep copy to avoid mutation
    const newState = this._deepCopy(gameState);

    // Update the board
    newState.board[position] = player;
    
    // Add to move history
    newState.moveHistory.push({
      player,
      position,
      timestamp: new Date()
    });

    // Check for game conclusion
    const winner = this.checkWinner(newState.board);
    if (winner) {
      newState.status = 'finished';
      newState.winner = winner;
    } else if (this.isBoardFull(newState.board)) {
      newState.status = 'finished';
      newState.winner = 'draw';
    } else {
      // Switch turns
      newState.currentPlayer = player === 'X' ? 'O' : 'X';
    }

    newState.updatedAt = new Date();
    return newState;
  }

  /**
   * Check if there's a winner
   * @param {Array} board - Current board state
   * @returns {string|null} 'X', 'O', or null
   */
  checkWinner(board) {
    for (const pattern of this.winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  /**
   * Check if board is full (draw)
   * @param {Array} board - Current board state
   * @returns {boolean}
   */
  isBoardFull(board) {
    return board.every(cell => cell !== null);
  }

  /**
   * Get game status summary
   * @param {Object} gameState - Current game state
   * @returns {Object} Game status information
   */
  getGameStatus(gameState) {
    const winner = this.checkWinner(gameState.board);
    const isFull = this.isBoardFull(gameState.board);
    
    let status = gameState.status;
    let winningPlayer = null;

    if (winner) {
      status = 'finished';
      winningPlayer = winner;
    } else if (isFull) {
      status = 'finished';
      winningPlayer = 'draw';
    }

    return {
      status,
      winner: winningPlayer,
      currentPlayer: gameState.currentPlayer,
      isGameOver: status === 'finished',
      board: gameState.board
    };
  }

  /**
   * Get available moves for current player
   * @param {Object} gameState - Current game state
   * @returns {Array} List of available positions
   */
  getAvailableMoves(gameState) {
    if (gameState.status !== 'playing') {
      return [];
    }

    return gameState.board
      .map((cell, index) => cell === null ? index : null)
      .filter(index => index !== null);
  }

  /**
   * Check if game is over
   * @param {Object} gameState - Current game state
   * @returns {boolean}
   */
  isGameOver(gameState) {
    return this.checkWinner(gameState.board) !== null || 
           this.isBoardFull(gameState.board);
  }

  /**
   * Get board visualization (for debugging/CLI)
   * @param {Array} board - Board state
   * @returns {string} Visual board representation
   */
  getBoardVisualization(board) {
    const cells = board.map((cell, index) => cell || index.toString());
    
    return `
 ${cells[0]} | ${cells[1]} | ${cells[2]}
----------- 
 ${cells[3]} | ${cells[4]} | ${cells[5]}
----------- 
 ${cells[6]} | ${cells[7]} | ${cells[8]}
    `;
  }

  /**
   * Generate a unique game ID
   * @returns {string} Unique game identifier
   */
  _generateGameId() {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep copy an object to avoid mutation
   * @param {Object} obj - Object to copy
   * @returns {Object} Deep copied object
   */
  _deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Export a singleton instance
module.exports = new TicTacToeGame();