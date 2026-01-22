import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

const STRIKE_THRESHOLD = 3;
const JANITOR_INTERVAL = 20000;
const ONLINE_SET_KEY = "online_players";

export const gatewayService = {
  async handleConnect(userId: string) {
    await publishEvent("player.kick", { userId });

    await publishEvent("player.connected", { userId, instanceId: config.instanceId });
  },

  async handleHeartbeat(userId: string) {
    await publishEvent("player.heartbeat", { userId });
  },

  async handleDisconnect(userId: string) {
    await publishEvent("player.disconnected", { userId });
  },

 async handlePrivateChat(
  senderId: string,
  recipientId: string,
  matchId: string,
  text: string
) {
  // 1. SECURITY: Verify both users are actually in the same match
  // This prevents users from "sniffing" IDs and messaging random players
  const [isSenderIn, isRecipientIn] = await Promise.all([
    redis.sismember(`match:participants:${matchId}`, senderId),
    redis.sismember(`match:participants:${matchId}`, recipientId),
  ]);

  if (!isSenderIn || !isRecipientIn) {
    console.warn(
      `[Chat] Security Alert: ${senderId} tried to message ${recipientId} outside of match ${matchId}`
    );
    return;
  }

  // 2. LOCATION LOOKUP: Pull the target instanceId from the presence hash
  // This is the new consolidated structure
  const targetInstanceId = await redis.hget(`presence:${recipientId}`, "instanceId");

  if (!targetInstanceId) {
    console.warn(
      `[Chat] Recipient ${recipientId} is offline or presence expired. Message dropped.`
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

  console.log(`[Chat] Message relayed from ${senderId} to ${recipientId} on ${targetInstanceId}`);
}
}