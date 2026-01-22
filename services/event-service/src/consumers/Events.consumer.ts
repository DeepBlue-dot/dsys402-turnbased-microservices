import { sendToUser, userSockets } from "../ws/ws.server.js";
import { config } from "../config/env.js";

export const handleEvents = async (event: {
  type: string;
  data: any;
  occurredAt: string;
}) => {
  const baseType = normalizeEventType(event.type);

  switch (baseType) {
    case "player.kick":
      await handlePlayerKick(event.data);
      break;

    case "chat.private":
      await handlePrivateChat(event.data);
      break;

    case "match.created":
      await handleMatchCreated(event.data);
      break;

    default:
      break;
  }
};


const normalizeEventType = (type: string): string => {
  const suffix = `.${config.instanceId}`;

  if (type.endsWith(suffix)) {
    return type.slice(0, -suffix.length);
  }

  return type;
};

const handlePlayerKick = async (payload: { userId: string }) => {
  const localSocket = userSockets.get(payload.userId);

  if (localSocket) {
    localSocket.wasKicked = true;

    console.log(
      `[WS] Kicking local session for ${payload.userId} (new login detected)`
    );

    localSocket.send(
      JSON.stringify({
        type: "ERROR",
        message: "You have been logged in from another device.",
      })
    );

    localSocket.terminate();
    userSockets.delete(payload.userId);
  }
};

const handlePrivateChat = async (payload: {
  to: string;
  from: string;
  text: string;
  matchId: string;
  sentAt: string;
}) => {
  sendToUser(payload.to, {
    type: "CHAT_MESSAGE",
    data: {
      from: payload.from,
      text: payload.text,
      matchId: payload.matchId,
      sentAt: payload.sentAt,
    },
  });
};

const handleMatchCreated = async (payload: {
  matchId: string;
  players: string[];
  mode: string;
}) => {
  payload.players.forEach((userId) => {
    sendToUser(userId, {
      type: "MATCH_CREATED",
      data: {
        matchId: payload.matchId,
        opponentId: payload.players.find((id) => id !== userId),
        mode: payload.mode,
      },
    });
  });
};
