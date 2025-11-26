const express = require("express");
const gameController = require("../controllers/gameController");

const router = express.Router();

// Get current game state
router.get('/:gameId', gameController.getGame);

// Make a move
router.post('/:gameId/moves', gameController.makeMove);

// Get move history
router.get('/:gameId/moves', gameController.getMoveHistory);

// Get available moves
router.get('/:gameId/available-moves', gameController.getAvailableMoves);

module.exports = router;