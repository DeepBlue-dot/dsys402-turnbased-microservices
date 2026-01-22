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

    case "game.event.started":
      await handleGameStarted(event.data);
      break;

    case "game.event.turn":
      await handleGameTurn(event.data);
      break;

    case "game.event.invalid":
      await handleInvalidMove(event.data);
      break;

    case "match.failed":
      await handleMatchFailed(event.data);
      break;

    case "match.ended":
      await handleMatchEnded(event.data);
      break;

    case "matchmaking.joined":
      sendToUser(event.data.userId, { type: "QUEUE_JOINED", data: event.data });
      break;

    case "matchmaking.left":
      sendToUser(event.data.userId, { type: "QUEUE_LEFT", data: event.data });
      break;

    default:
      break;
  }
};

/**
 * Strips the .gateway-instance-id from the RabbitMQ routing key
 */
const normalizeEventType = (type: string): string => {
  const suffix = `.${config.instanceId}`;
  return type.endsWith(suffix) ? type.slice(0, -suffix.length) : type;
};

/**
 * 🎯 PER-PLAYER HANDLERS
 * No more loops. We target the specific recipientId provided by the Game Logic.
 */

const handleGameStarted = async (payload: {
  recipientId: string;
  matchId: string;
  mySymbol: string;
  opponentId: string;
  turn: string;
  expiresAt: number;
}) => {
  sendToUser(payload.recipientId, {
    type: "GAME_STARTED",
    data: payload,
  });
};

const handleGameTurn = async (payload: {
  recipientId: string;
  matchId: string;
  board: string[];
  nextTurn: string;
  isMyTurn: boolean;
  expiresAt: number;
}) => {
  sendToUser(payload.recipientId, {
    type: "GAME_TURN",
    data: payload,
  });
};

const handleMatchEnded = async (payload: {
  recipientId: string;
  matchId: string;
  result: "WIN" | "LOSS" | "DRAW";
  reason: string;
  finalBoard: string[];
}) => {
  sendToUser(payload.recipientId, {
    type: "GAME_OVER",
    data: payload,
  });
};

const handleInvalidMove = async (payload: {
  recipientId: string;
  matchId: string;
  reason: string;
}) => {
  sendToUser(payload.recipientId, {
    type: "INVALID_MOVE",
    data: payload,
  });
};

const handleMatchFailed = async (payload: {
  recipientId: string;
  matchId: string;
  reason: string;
}) => {
  // If the game failed to start, tell the specific player
  sendToUser(payload.recipientId, {
    type: "MATCH_ERROR",
    data: { reason: payload.reason },
  });
};

/**
 * 🔄 SHARED/INFRASTRUCTURE HANDLERS
 */

const handlePlayerKick = async (payload: {
  userId: string;
  sessionId: string;
}) => {
  const localSocket = userSockets.get(payload.userId);

  // 🔑 ONLY kick if a socket exists AND it's not the one that triggered the kick
  if (localSocket && localSocket.sessionId !== payload.sessionId) {
    localSocket.wasKicked = true;

    console.log(`[WS] Kicking OLD session for ${payload.userId}`);

    localSocket.send(
      JSON.stringify({
        type: "ERROR",
        message: "You have been logged in from another device.",
      }),
    );

    localSocket.terminate();
    userSockets.delete(payload.userId);
  } else if (localSocket && localSocket.sessionId === payload.sessionId) {
    console.log(`[WS] Ignoring kick for CURRENT session ${payload.userId}`);
  }
};

const handlePrivateChat = async (payload: {
  to: string;
  from: string;
  text: string;
  matchId: string;
  sentAt: string;
}) => {
  // Recipient check is handled by RabbitMQ routing, but we verify local existence
  sendToUser(payload.to, {
    type: "CHAT_MESSAGE",
    data: payload,
  });
};

const handleMatchCreated = async (payload: {
  matchId: string;
  players: string[];
  mode: string;
}) => {
  // match.created is usually the first event. We check all players
  // and notify those who are physically on THIS instance.
  payload.players.forEach((userId) => {
    if (userSockets.has(userId)) {
      sendToUser(userId, {
        type: "MATCH_CREATED",
        data: {
          matchId: payload.matchId,
          opponentId: payload.players.find((id) => id !== userId),
          mode: payload.mode,
        },
      });
    }
  });
};
