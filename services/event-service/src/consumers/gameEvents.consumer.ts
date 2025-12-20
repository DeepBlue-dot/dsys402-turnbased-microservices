import { consume } from "../services/rabbitmq.service.js";
import { connections } from "../ws/presence.js";
import {
  joinRoom,
  leaveRoom,
  getRoomPlayers,
  removeRoom
} from "../ws/rooms.js";
import { config } from "../config/env.js";
import WebSocket from "ws";

export const startGameEventConsumer = async () => {
  await consume(config.gameEventsQueue, async (event) => {
    const { event: type, matchId } = event;

    if (!matchId) {
      console.warn("[EventService] Event without matchId", event);
      return;
    }

    switch (type) {
      /* ---------------- GAME LIFECYCLE ---------------- */

      case "game_initialized": {
        const players: string[] = event.players;

        players.forEach((playerId) =>
          joinRoom(matchId, playerId)
        );

        broadcast(matchId, event);
        break;
      }

      case "game_started": {
        broadcast(matchId, event);
        break;
      }

      case "game_finished":
      case "game_cancelled":
      case "game_timeout": {
        broadcast(matchId, event);
        removeRoom(matchId);
        break;
      }

      /* ---------------- TURN EVENTS ---------------- */

      case "turn_completed": {
        broadcast(matchId, event);
        break;
      }

      case "invalid_move": {
        sendToPlayer(event.playerId, event);
        break;
      }

      case "state_sync": {
        sendToPlayer(event.playerId, event);
        break;
      }

      /* ---------------- PLAYER CONTROL ---------------- */

      case "player_resigned": {
        broadcast(matchId, event);
        removeRoom(matchId);
        break;
      }

      /* ---------------- CONNECTION EVENTS ---------------- */

      case "game_paused": {
        broadcast(matchId, {
          ...event,
          message: "Opponent disconnected. Waiting for reconnection."
        });
        break;
      }

      case "game_resumed": {
        broadcast(matchId, {
          ...event,
          message: "Opponent reconnected. Game resumed."
        });
        break;
      }

      /* ---------------- FALLBACK ---------------- */

      default:
        console.warn(
          `[EventService] Unhandled event type: ${type}`
        );
        break;
    }
  });

  console.log("[EventService] Game events consumer running");
};


const broadcast = (matchId: string, event: any) => {
  const players = getRoomPlayers(matchId);

  players.forEach((playerId) => {
    const meta = connections.get(playerId);
    if (!meta) return;

    const socket = meta.socket;

    if (socket.readyState !== WebSocket.OPEN) {
      console.warn(
        `[EventService] Socket not open for player ${playerId}`
      );
      return;
    }

    socket.send(JSON.stringify(event));
  });
};

export const sendToPlayer = (playerId: string, event: any) => {
  const meta = connections.get(playerId);
  if (!meta) return;

  const socket = meta.socket;

  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(event));
};
