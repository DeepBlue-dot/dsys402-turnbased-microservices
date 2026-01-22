import { config } from "../config/env.js";
import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

export const gatewayService = {
  async handleConnect(userId: string) {
    await publishEvent("player.kick", { userId });

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
    await publishEvent("game.move", { userId, matchId, move });
  },

  async handleGameForfeit(userId: string, matchId: string) {
    await publishEvent("game.feit", { userId, matchId });
  },

  async handleSyncRequest(userId: string) {
    const presenceKey = `presence:${userId}`;
    const QUEUE_KEY = "match:queue:ranked";
    const JOIN_TIMES_KEY = "match:join_times";

    // 1. Fetch all state data in parallel for high performance
    const [presence, queueRank, joinTime] = await Promise.all([
      redis.hgetall(presenceKey),
      redis.zrank(QUEUE_KEY, userId), // Returns the 0-based position in queue
      redis.hget(JOIN_TIMES_KEY, userId), // Returns the timestamp they joined
    ]);

    // Scenario A: User has no presence key (Offline)
    if (!presence || Object.keys(presence).length === 0) {
      return {
        status: "OFFLINE",
        msg: "No active session found.",
      };
    }

    // 2. Build the Base State
    const state: any = {
      status: presence.status,
      userId: presence.userId,
      rating: parseInt(presence.rating || "1000"),
    };

    // Scenario B: User is in the Matchmaking Queue
    if (presence.status === "QUEUED" || queueRank !== null) {
      state.status = "QUEUED"; // Force sync if there was a status mismatch
      state.queue = {
        position: queueRank !== null ? queueRank + 1 : null,
        joinedAt: joinTime ? new Date(parseInt(joinTime)).toISOString() : null,
        waitTimeSeconds: joinTime
          ? Math.floor((Date.now() - parseInt(joinTime)) / 1000)
          : 0,
      };
    }

    // Scenario C: User is in an active game
    if (presence.status === "IN_GAME") {
    }

    return state;
  },

  async handlePrivateChat(
    senderId: string,
    recipientId: string,
    matchId: string,
    text: string,
  ) {
    // 1. SECURITY: Verify both users are actually in the same match
    // This prevents users from "sniffing" IDs and messaging random players
    const [isSenderIn, isRecipientIn] = await Promise.all([
      redis.sismember(`match:participants:${matchId}`, senderId),
      redis.sismember(`match:participants:${matchId}`, recipientId),
    ]);

    if (!isSenderIn || !isRecipientIn) {
      console.warn(
        `[Chat] Security Alert: ${senderId} tried to message ${recipientId} outside of match ${matchId}`,
      );
      return;
    }

    // 2. LOCATION LOOKUP: Pull the target instanceId from the presence hash
    // This is the new consolidated structure
    const targetInstanceId = await redis.hget(
      `presence:${recipientId}`,
      "instanceId",
    );

    if (!targetInstanceId) {
      console.warn(
        `[Chat] Recipient ${recipientId} is offline or presence expired. Message dropped.`,
      );
      return;
    }

    // 3. TARGETED PUBLISH: Direct the event to the specific Gateway instance
    // The Routing Key will be e.g., "chat.private.gateway-01"
    await publishEvent(`chat.private.${targetInstanceId}`, {
      from: senderId,
      to: recipientId,
      matchId,
      text,
      sentAt: new Date().toISOString(),
    });

    console.log(
      `[Chat] Message relayed from ${senderId} to ${recipientId} on ${targetInstanceId}`,
    );
  },
};
