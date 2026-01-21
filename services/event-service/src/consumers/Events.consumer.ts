import { sendToUser, userSockets } from "../ws/ws.server.js";

export const handleEvents = async (event: {
  type: string;
  data: any;
  occurredAt: string;
}) => {
  switch (event.type) {
    case "player.kick":
      await handlePlayerKick(event.data);
      break;

    case "chat.private":
      await handlePrivateChat(event.data);
      break;

    case "match.created":
      await handleMatchCreated(event.data);
      break;
  }
};

const handlePlayerKick = async (playload: { userId: string }) => {
  const localSocket = userSockets.get(playload.userId);

  if (localSocket) {
    localSocket.wasKicked = true;
    console.log(
      `[WS] Kicking local session for ${playload.userId} (new login detected)`,
    );
    localSocket.send(
      JSON.stringify({
        type: "ERROR",
        message: "You have been logged in from another device.",
      }),
    );
    localSocket.terminate();
    userSockets.delete(playload.userId);
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
