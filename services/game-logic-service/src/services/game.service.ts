import { redis } from "../config/redis.js";
import { MatchHistory } from "../models/MatchHistory.model.js";
import { ticTacToeEngine, Board } from "../engine/tic-tac-toe.engine.js";
import { publishEvent } from "./rabbitmq.service.js";
import { config } from "../config/env.js";

const TIMERS_KEY = "game:timers";
const PRESENCE_PREFIX = "presence:";

export const gameService = {
  /**
   * HELPER: Get location of a specific player
   */
  async getPlayerLocation(userId: string) {
    const data = await redis.hgetall(`${PRESENCE_PREFIX}${userId}`);
    if (!data || !data.instanceId) return null;
    return { userId, instanceId: data.instanceId };
  },

  async setTurnTimer(matchId: string) {
    const deadline = Date.now() + config.turnTimeoutSec * 1000;
    await redis.zadd(TIMERS_KEY, deadline, matchId);
  },

  async clearTurnTimer(matchId: string) {
    await redis.zrem(TIMERS_KEY, matchId);
  },

  /**
   * INITIALIZE: Send specific "Match Started" event to each player
   */
  async initializeGame(matchId: string, players: string[]) {
    try {
      const locations = await Promise.all(
        players.map((id) => this.getPlayerLocation(id)),
      );

      if (locations.some((l) => l === null)) {
        const innocentPlayers = locations
          .filter((l) => l !== null)
          .map((l) => l!.userId);
        return await publishEvent("match.failed", {
          matchId,
          players,
          reason: "PLAYER_OFFLINE",
          innocentPlayers,
        });
      }

      const board: Board = Array(9).fill("");
      const symbols = { [players[0]]: "X", [players[1]]: "O" };
      const expiresAt = Date.now() + config.turnTimeoutSec * 1000;

      await redis
        .pipeline()
        .hset(`game:match:${matchId}`, {
          matchId,
          players: JSON.stringify(players),
          board: JSON.stringify(board),
          symbols: JSON.stringify(symbols),
          turn: players[0],
          status: "ACTIVE",
          expiresAt: expiresAt.toString(),
        })
        .set(`player:match_map:${players[0]}`, matchId)
        .set(`player:match_map:${players[1]}`, matchId)
        .hset(`${PRESENCE_PREFIX}${players[0]}`, { status: "IN_GAME", matchId })
        .hset(`${PRESENCE_PREFIX}${players[1]}`, { status: "IN_GAME", matchId })
        .exec();

      await this.setTurnTimer(matchId);

      // 🎯 PER-PLAYER PUBLISH
      for (const loc of locations) {
        if (loc) {
          await publishEvent(`game.event.started.${loc.instanceId}`, {
            recipientId: loc.userId, // 🔑 Tells Gateway exactly who to notify
            matchId,
            mySymbol: symbols[loc.userId],
            opponentId: players.find((id) => id !== loc.userId),
            turn: players[0],
            expiresAt,
          });
        }
      }
    } catch (err) {
      await publishEvent("match.failed", {
        matchId,
        players,
        reason: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * MOVE: Send specific "Board Update" to each player
   */
  async processMove(matchId: string, userId: string, position: number) {
    const key = `game:match:${matchId}`;
    const state = await redis.hgetall(key);

    // ❌ Invalid: match doesn't exist or not user's turn
    if (!state || Object.keys(state).length === 0 || state.turn !== userId) {
      const loc = await this.getPlayerLocation(userId);
      if (loc) {
        await publishEvent(`game.event.invalid.${loc.instanceId}`, {
          recipientId: userId,
          matchId,
          reason: !state ? "MATCH_NOT_FOUND" : "NOT_YOUR_TURN",
        });
      }
      return;
    }

    const board: Board = JSON.parse(state.board);

    // ❌ Invalid: cell already taken
    if (board[position] !== "") {
      const loc = await this.getPlayerLocation(userId);
      if (loc) {
        await publishEvent(`game.event.invalid.${loc.instanceId}`, {
          recipientId: userId,
          matchId,
          reason: "CELL_OCCUPIED",
        });
      }
      return;
    }

    // ✅ Valid move: proceed as normal
    await this.clearTurnTimer(matchId);
    const symbols = JSON.parse(state.symbols);
    board[position] = symbols[userId];

    const { status, winner } = ticTacToeEngine.getGameState(board);

    if (status !== "ONGOING") {
      await this.endGame(
        matchId,
        board,
        winner ? userId : null,
        status === "WIN" ? "COMPLETED" : "DRAW",
      );
    } else {
      const players: string[] = JSON.parse(state.players);
      const nextTurn = players.find((id) => id !== userId)!;
      const expiresAt = Date.now() + config.turnTimeoutSec * 1000;

      await redis.hset(key, {
        board: JSON.stringify(board),
        turn: nextTurn,
        expiresAt: expiresAt.toString(),
      });

      await this.setTurnTimer(matchId);

      // 🎯 Notify both players
      const locations = await Promise.all(
        players.map((id) => this.getPlayerLocation(id)),
      );
      for (const loc of locations) {
        if (loc) {
          await publishEvent(`game.event.turn.${loc.instanceId}`, {
            recipientId: loc.userId,
            matchId,
            board,
            nextTurn,
            isMyTurn: nextTurn === loc.userId,
            expiresAt,
          });
        }
      }
    }
  },
  /**
   * END GAME: Send final results to each player
   */
  async endGame(
    matchId: string,
    finalBoard: Board,
    winnerId: string | null,
    reason: string,
  ) {
    const state = await redis.hgetall(`game:match:${matchId}`);
    if (!state || Object.keys(state).length === 0) return;

    const players: string[] = JSON.parse(state.players);

    // 1. Archive
    await MatchHistory.create({
      matchId,
      players,
      winnerId,
      finalBoard,
      reason,
    });

    // 2. Locate and Update Status
    const locations = await Promise.all(
      players.map((id) => this.getPlayerLocation(id)),
    );
    const pipeline = redis.pipeline();
    for (const pid of players) {
      pipeline.del(`player:match_map:${pid}`);
      if (await redis.exists(`${PRESENCE_PREFIX}${pid}`)) {
        pipeline
          .hset(`${PRESENCE_PREFIX}${pid}`, { status: "IDLE" })
          .hdel(`${PRESENCE_PREFIX}${pid}`, "matchId");
      }
    }
    pipeline.del(`game:match:${matchId}`).zrem(TIMERS_KEY, matchId);
    await pipeline.exec();

    // 🎯 PER-PLAYER PUBLISH
    for (const loc of locations) {
      if (loc) {
        await publishEvent(`match.ended.${loc.instanceId}`, {
          recipientId: loc.userId,
          matchId,
          result:
            winnerId === loc.userId
              ? "WIN"
              : winnerId === null
                ? "DRAW"
                : "LOSS",
          reason,
          finalBoard,
        });
      }
    }

    await publishEvent("match.ended", { matchId, players, winnerId, reason });
  },

  async handlePlayerDisconnect(userId: string) {
    const matchId = await redis.get(`player:match_map:${userId}`);
    if (!matchId) return;
    const state = await redis.hgetall(`game:match:${matchId}`);
    if (!state) return;

    const players: string[] = JSON.parse(state.players);
    const winnerId = players.find((id) => id !== userId) || null;
    await this.clearTurnTimer(matchId);
    await this.endGame(matchId, JSON.parse(state.board), winnerId, "FORFEIT");
  },

  /**
   * FORFEIT: User manually clicks "Surrender"
   */
  async handleForfeit(matchId: string, userId: string) {
    const matchKey = `game:match:${matchId}`;
    const state = await redis.hgetall(matchKey);

    // 1. Validation
    if (!state || Object.keys(state).length === 0) return;

    const players: string[] = JSON.parse(state.players);
    if (!players.includes(userId)) return; // Security: User not in this match

    // 2. Identify the Winner (the one who didn't forfeit)
    const winnerId = players.find((id) => id !== userId) || null;
    const board: Board = JSON.parse(state.board);

    // 3. Stop the turn clock
    await this.clearTurnTimer(matchId);

    // 4. Finalize
    // This calls endGame which handles Mongo archive, Redis cleanup,
    // Targeted Gateway UI updates, and Global ELO broadcast.
    await this.endGame(matchId, board, winnerId, "FORFEIT");

    console.log(`[GameService] Player ${userId} forfeited match ${matchId}`);
  },
};
