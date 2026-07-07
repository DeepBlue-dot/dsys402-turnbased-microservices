import { redis } from "../config/redis.js";
import { MatchHistory } from "../models/MatchHistory.model.js";
import { ticTacToeEngine, Board } from "../engine/tic-tac-toe.engine.js";
import { publishEvent } from "./rabbitmq.service.js";
import { config } from "../config/env.js";
import { v4 as uuidv4 } from "uuid";

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

    await redis
      .pipeline()
      .hset(key, {
        board: JSON.stringify(board),
        turn: nextTurn,
        expiresAt: expiresAt.toString(),
        moves: JSON.stringify(moves),
        turnCount: (Number(state.turnCount) + 1).toString(),
      })
      .hdel(key, "drawProposedBy")
      .exec();

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
          drawProposedBy: null,
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
      pipeline.set(`player:last_match:${pid}`, matchId, "EX", 60);
    }
    pipeline.del(`game:match:${matchId}`).zrem(TIMERS_KEY, matchId);
    pipeline.hset(`game:rematch:${matchId}`, {
      players: JSON.stringify(players),
      status: "idle",
      requestedBy: "",
    });
    pipeline.expire(`game:rematch:${matchId}`, 60);
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

  async handleDrawPropose(matchId: string, userId: string) {
    const key = `game:match:${matchId}`;
    const state = await redis.hgetall(key);
    if (!state || Object.keys(state).length === 0 || state.status !== "ACTIVE") {
      return;
    }

    const players: string[] = JSON.parse(state.players);
    if (!players.includes(userId)) return;

    const existingDrawProposer = state.drawProposedBy;

    if (existingDrawProposer) {
      if (existingDrawProposer !== userId) {
        // Confirm draw since opponent already proposed it
        await this.clearTurnTimer(matchId);
        await this.endGame(matchId, JSON.parse(state.board), null, "DRAW");
      }
      return;
    }

    // Otherwise, propose draw
    await redis.hset(key, { drawProposedBy: userId });

    const locations = await Promise.all(
      players.map((id) => this.getPlayerLocation(id)),
    );

    for (const loc of locations) {
      if (loc) {
        await publishEvent(`game.event.draw_proposed.${loc.instanceId}`, {
          recipientId: loc.userId,
          matchId,
          proposedBy: userId,
        });
      }
    }
  },

  async handleDrawConfirm(matchId: string, userId: string) {
    const key = `game:match:${matchId}`;
    const state = await redis.hgetall(key);
    if (!state || Object.keys(state).length === 0 || state.status !== "ACTIVE") {
      return;
    }

    const players: string[] = JSON.parse(state.players);
    if (!players.includes(userId)) return;

    const existingDrawProposer = state.drawProposedBy;
    if (existingDrawProposer && existingDrawProposer !== userId) {
      await this.clearTurnTimer(matchId);
      await this.endGame(matchId, JSON.parse(state.board), null, "DRAW");
    }
  },

  async handleDrawDecline(matchId: string, userId: string) {
    const key = `game:match:${matchId}`;
    const state = await redis.hgetall(key);
    if (!state || Object.keys(state).length === 0 || state.status !== "ACTIVE") {
      return;
    }

    const players: string[] = JSON.parse(state.players);
    if (!players.includes(userId)) return;

    // Only decline if there is an active draw proposal
    if (!state.drawProposedBy) return;

    await redis.hdel(key, "drawProposedBy");

    const locations = await Promise.all(
      players.map((id) => this.getPlayerLocation(id)),
    );

    for (const loc of locations) {
      if (loc) {
        await publishEvent(`game.event.draw_declined.${loc.instanceId}`, {
          recipientId: loc.userId,
          matchId,
        });
      }
    }
  },

  /* ───────────────────────── REMATCH ───────────────────────── */

  async handleRematchRequest(matchId: string, userId: string) {
    const key = `game:rematch:${matchId}`;
    const rematch = await redis.hgetall(key);
    if (!rematch || Object.keys(rematch).length === 0) {
      const loc = await this.getPlayerLocation(userId);
      if (loc) {
        await publishEvent(`game.event.rematch_expired.${loc.instanceId}`, {
          recipientId: userId,
          matchId,
        });
      }
      return;
    }

    const players: string[] = JSON.parse(rematch.players);
    if (!players.includes(userId)) return;

    const currentStatus = rematch.status;
    const requestedBy = rematch.requestedBy;

    if (currentStatus === "idle") {
      // Transition to pending
      const opponentId = players.find((id) => id !== userId)!;
      const opponentPresence = await redis.hgetall(`${PRESENCE_PREFIX}${opponentId}`);
      if (opponentPresence && opponentPresence.status === "IN_GAME") {
        // Opponent is already in a game, expire rematch
        await redis.pipeline()
          .del(key)
          .zrem("rematch:timers", matchId)
          .exec();

        const locations = await Promise.all(
          players.map((id) => this.getPlayerLocation(id))
        );
        for (const loc of locations) {
          if (loc) {
            await publishEvent(`game.event.rematch_expired.${loc.instanceId}`, {
              recipientId: loc.userId,
              matchId,
            });
          }
        }
        return;
      }

      await redis.pipeline()
        .hset(key, { status: "pending", requestedBy: userId })
        .zadd("rematch:timers", Date.now() + 30000, matchId)
        .exec();

      const locations = await Promise.all(
        players.map((id) => this.getPlayerLocation(id))
      );

      for (const loc of locations) {
        if (loc) {
          await publishEvent(`game.event.rematch_status.${loc.instanceId}`, {
            recipientId: loc.userId,
            matchId,
            status: "pending",
            requestedBy: userId,
          });
        }
      }
    } else if (currentStatus === "pending") {
      if (requestedBy !== userId) {
        // Both players agreed -> REMATCH ACCEPTED!

        // Verify both players are online and not IN_GAME
        const [p1Presence, p2Presence] = await Promise.all([
          redis.hgetall(`${PRESENCE_PREFIX}${players[0]}`),
          redis.hgetall(`${PRESENCE_PREFIX}${players[1]}`),
        ]);

        const p1Valid = p1Presence && Object.keys(p1Presence).length > 0 && p1Presence.status !== "IN_GAME";
        const p2Valid = p2Presence && Object.keys(p2Presence).length > 0 && p2Presence.status !== "IN_GAME";

        if (!p1Valid || !p2Valid) {
          // One or both players are in-game or offline, expire rematch
          await redis.pipeline()
            .del(key)
            .zrem("rematch:timers", matchId)
            .exec();

          const locations = await Promise.all(
            players.map((id) => this.getPlayerLocation(id))
          );
          for (const loc of locations) {
            if (loc) {
              await publishEvent(`game.event.rematch_expired.${loc.instanceId}`, {
                recipientId: loc.userId,
                matchId,
              });
            }
          }
          return;
        }

        // Delete rematch record and timer, and evict them from matchmaking queue if they queued
        await redis.pipeline()
          .del(key)
          .zrem("rematch:timers", matchId)
          .zrem("match:queue:ranked", players[0], players[1])
          .hdel("match:join_times", players[0], players[1])
          .exec();

        const newMatchId = uuidv4();

        // Target each player's instance for match.created
        const locations = await Promise.all(
          players.map((id) => this.getPlayerLocation(id))
        );

        const instance1 = locations[0]?.instanceId;
        const instance2 = locations[1]?.instanceId;

        if (instance1) {
          await publishEvent(`match.created.${instance1}`, {
            matchId: newMatchId,
            players,
            mode: "ranked",
          });
        }
        if (instance2 && instance2 !== instance1) {
          await publishEvent(`match.created.${instance2}`, {
            matchId: newMatchId,
            players,
            mode: "ranked",
          });
        }

        // Publish global match.created to trigger game initialization and player-service updates
        await publishEvent(`match.created`, {
          matchId: newMatchId,
          players,
          mode: "ranked",
        });
      }
    }
  },

  async handleRematchDecline(matchId: string, userId: string) {
    const key = `game:rematch:${matchId}`;
    const rematch = await redis.hgetall(key);
    if (!rematch || Object.keys(rematch).length === 0) return;

    const players: string[] = JSON.parse(rematch.players);
    if (!players.includes(userId)) return;

    // Explicit decline: delete record, clean up timer, and notify both players
    await redis.pipeline()
      .del(key)
      .zrem("rematch:timers", matchId)
      .exec();

    const locations = await Promise.all(
      players.map((id) => this.getPlayerLocation(id))
    );

    for (const loc of locations) {
      if (loc) {
        await publishEvent(`game.event.rematch_expired.${loc.instanceId}`, {
          recipientId: loc.userId,
          matchId,
        });
      }
    }
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
