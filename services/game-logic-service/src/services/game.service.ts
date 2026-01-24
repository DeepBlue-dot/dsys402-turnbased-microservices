import { redis } from "../config/redis.js";
import { MatchHistory } from "../models/MatchHistory.model.js";
import { ticTacToeEngine, Board } from "../engine/tic-tac-toe.engine.js";
import { publishEvent } from "./rabbitmq.service.js";
import { config } from "../config/env.js";

const TIMERS_KEY = "game:timers";
const PRESENCE_PREFIX = "presence:";

export const gameService = {
  /* ───────────────────────── HELPERS ───────────────────────── */

  async getPlayerLocation(userId: string) {
    const data = await redis.hgetall(`${PRESENCE_PREFIX}${userId}`);
    if (!data || !data.instanceId) return null;
    return { userId, instanceId: data.instanceId, status: data.status };
  },

  async setTurnTimer(matchId: string) {
    const deadline = Date.now() + config.turnTimeoutSec * 1000;
    await redis.zadd(TIMERS_KEY, deadline, matchId);
  },

  async clearTurnTimer(matchId: string) {
    await redis.zrem(TIMERS_KEY, matchId);
  },

  /* ───────────────────────── INITIALIZE GAME ───────────────────────── */

  async initializeGame(matchId: string, players: string[]) {
    try {
      const locations = await Promise.all(
        players.map((id) => this.getPlayerLocation(id)),
      );

      if (locations.some((l) => l === null)) {
        return publishEvent("match.failed", {
          matchId,
          players,
          reason: "PLAYER_OFFLINE",
          innocentPlayers: locations.filter(Boolean).map((l) => l!.userId),
        });
      }

      const board: Board = Array(9).fill("");
      const symbols = { [players[0]]: "X", [players[1]]: "O" };
      const startedAt = Date.now();
      const expiresAt = startedAt + config.turnTimeoutSec * 1000;

      await redis
        .pipeline()
        .hset(`game:match:${matchId}`, {
          matchId,
          players: JSON.stringify(players),
          board: JSON.stringify(board),
          symbols: JSON.stringify(symbols),

          firstTurn: players[0],
          turn: players[0],

          moves: JSON.stringify([]),
          turnCount: "0",

          startedAt: startedAt.toString(),
          status: "ACTIVE",
          expiresAt: expiresAt.toString(),
        })
        .set(`player:match_map:${players[0]}`, matchId)
        .set(`player:match_map:${players[1]}`, matchId)
        .hset(`${PRESENCE_PREFIX}${players[0]}`, { status: "IN_GAME", matchId })
        .hset(`${PRESENCE_PREFIX}${players[1]}`, { status: "IN_GAME", matchId })
        .exec();

      await this.setTurnTimer(matchId);

      for (const loc of locations) {
        if (loc) {
          await publishEvent(`game.event.started.${loc.instanceId}`, {
            recipientId: loc.userId,
            matchId,
            mySymbol: symbols[loc.userId],
            opponentId: players.find((id) => id !== loc.userId),
            turn: players[0],
            expiresAt,
          });
        }
      }
    } catch {
      await publishEvent("match.failed", {
        matchId,
        players,
        reason: "INTERNAL_ERROR",
      });
    }
  },

  /* ───────────────────────── PROCESS MOVE ───────────────────────── */

  async processMove(matchId: string, userId: string, position: number) {
    const key = `game:match:${matchId}`;
    const state = await redis.hgetall(key);

    if (
      !Number.isInteger(position) ||
      position < 0 ||
      position > 8
    ) {
      return this.publishInvalid(userId, matchId, "INVALID_POSITION");
    }

    if (!state || Object.keys(state).length === 0 || state.turn !== userId) {
      return this.publishInvalid(
        userId,
        matchId,
        !state || Object.keys(state).length === 0
          ? "MATCH_NOT_FOUND"
          : "NOT_YOUR_TURN",
      );
    }

    const board: Board = JSON.parse(state.board);
    if (board[position] !== "") {
      return this.publishInvalid(userId, matchId, "CELL_OCCUPIED");
    }

    await this.clearTurnTimer(matchId);

    const symbols = JSON.parse(state.symbols);
    const moves = JSON.parse(state.moves || "[]");

    board[position] = symbols[userId];
    moves.push({
      playerId: userId,
      position,
      symbol: symbols[userId],
      at: new Date(),
    });

    const { status, winner } = ticTacToeEngine.getGameState(board);

    if (status !== "ONGOING") {
      await this.endGame(
        matchId,
        board,
        winner ? userId : null,
        status === "WIN" ? "COMPLETED" : "DRAW",
      );
      return;
    }

    const players: string[] = JSON.parse(state.players);
    const nextTurn = players.find((id) => id !== userId)!;
    const expiresAt = Date.now() + config.turnTimeoutSec * 1000;

    await redis.hset(key, {
      board: JSON.stringify(board),
      turn: nextTurn,
      expiresAt: expiresAt.toString(),
      moves: JSON.stringify(moves),
      turnCount: (Number(state.turnCount) + 1).toString(),
    });

    await this.setTurnTimer(matchId);

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
  },

  /* ───────────────────────── END GAME ───────────────────────── */

  async endGame(
    matchId: string,
    finalBoard: Board,
    winnerId: string | null,
    reason: "COMPLETED" | "DRAW" | "FORFEIT" | "TIMEOUT",
  ) {
    const state = await redis.hgetall(`game:match:${matchId}`);
    if (!state || Object.keys(state).length === 0) return;

    const players: string[] = JSON.parse(state.players);
    const startedAt = new Date(Number(state.startedAt));
    const endedAt = new Date();

    await MatchHistory.create({
      matchId,
      players,
      winnerId,

      symbols: JSON.parse(state.symbols),
      firstTurn: state.firstTurn,

      finalBoard,
      moves: JSON.parse(state.moves || "[]"),
      turnCount: Number(state.turnCount),

      reason,
      startedAt,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
    });

    const locations = await Promise.all(
      players.map((id) => this.getPlayerLocation(id)),
    );

    const pipeline = redis.pipeline();
    for (const pid of players) {
      pipeline.del(`player:match_map:${pid}`);
      pipeline.hset(`${PRESENCE_PREFIX}${pid}`, { status: "IDLE" });
      pipeline.hdel(`${PRESENCE_PREFIX}${pid}`, "matchId");
    }
    pipeline.del(`game:match:${matchId}`).zrem(TIMERS_KEY, matchId);
    await pipeline.exec();

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

  /* ───────────────────────── DISCONNECT / FORFEIT ───────────────────────── */

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

  async handleForfeit(matchId: string, userId: string) {
    const state = await redis.hgetall(`game:match:${matchId}`);
    if (!state || Object.keys(state).length === 0) return;

    const players: string[] = JSON.parse(state.players);
    if (!players.includes(userId)) return;

    const winnerId = players.find((id) => id !== userId) || null;
    await this.clearTurnTimer(matchId);
    await this.endGame(matchId, JSON.parse(state.board), winnerId, "FORFEIT");
  },

  /* ───────────────────────── UTIL ───────────────────────── */

  async publishInvalid(userId: string, matchId: string, reason: string) {
    const loc = await this.getPlayerLocation(userId);
    if (loc) {
      await publishEvent(`game.event.invalid.${loc.instanceId}`, {
        recipientId: userId,
        matchId,
        reason,
      });
    }
  },
};
