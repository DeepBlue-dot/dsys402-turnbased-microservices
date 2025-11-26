const gameLogic = require('../services/gameLogic');
const { publishTurnCompleted, publishGameEnded } = require('../events/producer');

const gameController = {
    // Get current game state

    async getGame(req, res) {
        try {
            const { gameId } = req.params;

            // For now, we'll use in-memory storage
            // Later we'll replace this with database lookup
            const game = await Game.findOne({ gameId }); // TODO: Implement

            const validation = gameLogic.validateGameAccess(game, gameId);
            if (!validation.valid) {
                return res.status(validation.statusCode).json({ error: validation.error });
            }

            const gameSummary = gameLogic.getGameSummary(game);
            res.json(gameSummary);
        } catch (error) {
            console.error('Error getting game:', error);
            res.status(500).json({
                error: 'Failed to retrieve game',
                message: error.message
            });
        }
    },
    /**
   * Make a move in the game
   */
    async makeMove(req, res) {
        try {
            const { gameId } = req.params;
            const { player, position } = req.body;

            // Get current game state
            // For now, using in-memory - we'll add database next
            let game = await Game.findOne({ gameId }); // TODO: Implement

            const accessValidation = gameLogic.validateGameAccess(game, gameId);
            if (!accessValidation.valid) {
                return res.status(accessValidation.statusCode).json({
                    error: accessValidation.error
                });
            }

            const moveResult = gameLogic.processMove(game, moveData);
            if (!moveResult.success) {
                return res.status(moveResult.statusCode).json({
                    error: moveResult.error
                });
            }

            const updatedGame = moveResult.data;
            await Game.updateOne({ gameId }, updatedGame);// TODO: Implement


            if (updatedGame.status === 'finished') {
                await publishGameEnded(updatedGame);
            } else {
                await publishTurnCompleted(updatedGame);
            }



            // Return formatted response
            res.json({
                success: true,
                game: gameLogic.getGameSummary(updatedGame),
                move: {
                    player: moveData.player,
                    position: moveData.position
                }
            });

        } catch (error) {
            console.error('Error making move:', error);
            res.status(500).json({
                error: 'Failed to make move',
                message: error.message
            });
        }
    },

    /**
     * Get move history for a game
     */
    async getMoveHistory(req, res) {
        try {
            const { gameId } = req.params;
            const game = await Game.findOne({ gameId }); // TODO: Implement

            const validation = gameLogic.validateGameAccess(game, gameId);
            if (!validation.valid) {
                return res.status(validation.statusCode).json({ error: validation.error });
            }

            res.json({
                gameId,
                moves: game.moveHistory,
                totalMoves: game.moveHistory.length
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get move history',
                message: error.message
            });
        }
    },

    /**
     * Get available moves for current player
     */
    async getAvailableMoves(req, res) {
        try {
            const { gameId } = req.params;
            const game = await Game.findOne({ gameId }); // TODO: Implement

            const validation = gameLogic.validateGameAccess(game, gameId);
            if (!validation.valid) {
                return res.status(validation.statusCode).json({ error: validation.error });
            }

            const availableMoves = gameLogic.getAvailableMoves(game);

            res.json({
                gameId,
                currentPlayer: game.currentPlayer,
                availableMoves,
                totalAvailable: availableMoves.length
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get available moves',
                message: error.message
            });
        }
    },
    async createGameFromMatch(matchData) {
        try {
            console.log(`🎮 Creating new game from match: ${matchData.gameId}`);

            // Create game using our game logic
            const newGame = gameLogic.createGame({
                playerX: matchData.players[0],
                playerO: matchData.players[1]
            });

            // Override gameId with the one from matchmaking
            newGame.gameId = matchData.gameId;

            // Save to storage
            await Game.create(newGame);

            console.log(`Game created successfully: ${matchData.gameId}`);
            return newGame;
        } catch (error) {
            console.error('Error creating game from match:', error);
            throw error;
        }
    }
}

module.exports = gameController;