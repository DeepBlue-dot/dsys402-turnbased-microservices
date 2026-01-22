import { config } from "../config/env.js";
import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

const QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";

export const gatewayService = {
  async handleConnect(userId: string, sessionId: string) {
    await publishEvent("player.kick", { userId, sessionId });

    await publishEvent("player.connected", {
      userId,
      instanceId: config.instanceId,
    });
  },

  async handleHeartbeat(userId: string) {
    await publishEvent("player.heartbeat", { userId });
  },

  async handleDisconnect(userId: string) {
    await publishEvent("player.disconnected", { userId });
  },

  async handleGameMove(userId: string, matchId: string, move: string) {
    await publishEvent("game.cmd.move", { userId, matchId, move });
  },

  async handleGameForfeit(userId: string, matchId: string) {
    await publishEvent("game.cmd.feit", { userId, matchId });
  },

  async handleSyncRequest(userId: string) {
    const presenceKey = `presence:${userId}`;

    // 1. Fetch presence and match mapping in parallel
    const [presence, matchId, queueRank, joinTime] = await Promise.all([
      redis.hgetall(presenceKey),
      redis.get(`player:match_map:${userId}`), // Direct index lookup
      redis.zrank(QUEUE_KEY, userId),
      redis.hget(JOIN_TIMES_KEY, userId),
    ]);

    if (!presence || Object.keys(presence).length === 0) {
      return { status: "OFFLINE" };
    }

    const state: any = {
      status: presence.status,
      userId: presence.userId,
      rating: parseInt(presence.rating || "1000"),
    };

    // --- Scenario: QUEUED ---
    if (presence.status === "QUEUED" || queueRank !== null) {
      state.status = "QUEUED";
      state.queue = {
        position: queueRank !== null ? queueRank + 1 : null,
        waitTimeSeconds: joinTime
          ? Math.floor((Date.now() - parseInt(joinTime)) / 1000)
          : 0,
      };
    }

    // --- Scenario: IN_GAME ---

    if (matchId) {
      const gameKey = `game:match:${matchId}`;
      const gameData = await redis.hgetall(gameKey);

      if (gameData && Object.keys(gameData).length > 0) {
        const players: string[] = JSON.parse(gameData.players || "[]");
        const symbols: Record<string, string> = JSON.parse(
          gameData.symbols || "{}",
        );
        const board = JSON.parse(gameData.board || "[]");

        state.status = "IN_GAME";
        state.game = {
          matchId: gameData.matchId,
          players,
          board,
          turn: gameData.turn,
          mySymbol: symbols[userId],
          status: gameData.status,
          version: Number(gameData.version || 0),
          expiresAt: Number(gameData.expiresAt),
        };
      } else {
        // 🔥 Self-heal: dangling index
        await redis.del(`player:match_map:${userId}`);
        await redis.hset(`presence:${userId}`, "status", "IDLE");
        state.status = "IDLE";
      }
    }

    return state;
  },

  /**
   * PRIVATE CHAT: Uses match_map for zero-trust security
   */
  async handlePrivateChat(
    senderId: string,
    recipientId: string,
    matchId: string,
    text: string,
  ) {
    const [senderMatch, recipientMatch] = await Promise.all([
      redis.get(`player:match_map:${senderId}`),
      redis.get(`player:match_map:${recipientId}`),
    ]);

    if (senderMatch !== matchId || recipientMatch !== matchId) {
      console.warn(
        `[Chat] Security Block: ${senderId} attempted unauthorized chat in ${matchId}`,
      );
      return;
    }

    const targetInstanceId = await redis.hget(
      `presence:${recipientId}`,
      "instanceId",
    );

    if (!targetInstanceId) {
      console.log(
        `[Chat] Recipient ${recipientId} is offline. Message dropped.`,
      );
      return;
    }

    // 4. DIRECTED RELAY
    await publishEvent(`chat.private.${targetInstanceId}`, {
      from: senderId,
      to: recipientId,
      matchId,
      text,
      sentAt: new Date().toISOString(),
    });
  },
};
