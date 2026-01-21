import { redis } from "../config/redis.js";
import { publishEvent } from "./rabbitmq.service.js";

const STRIKE_THRESHOLD = 3;
const JANITOR_INTERVAL = 20000;
const ONLINE_SET_KEY = "online_players";

export const gatewayService = {
  async handleConnect(userId: string) {
    await publishEvent("player.kick", { userId });

    await publishEvent("player.connected", { userId });
  },

  async handleHeartbeat(userId: string) {
    await publishEvent("player.heartbeat", { userId });
  },

  async handleDisconnect(userId: string) {
    await publishEvent("player.disconnected", { userId });
  },

  async handlePrivateChat(senderId: string, recipientId: string, matchId: string, text: string) {

    const [isSenderIn, isRecipientIn] = await Promise.all([
      redis.sismember(`match:participants:${matchId}`, senderId),
      redis.sismember(`match:participants:${matchId}`, recipientId)
    ]);

    if (isSenderIn && isRecipientIn) {
      // 2. Publish a direct message event
      await publishEvent("chat.private", {
        from: senderId,
        to: recipientId,
        matchId: matchId,
        text: text,
        sentAt: new Date().toISOString()
      });
    } else {
      console.warn(`[Chat] Security Alert: ${senderId} tried to message ${recipientId} outside of match ${matchId}`);
    }
  }
};
