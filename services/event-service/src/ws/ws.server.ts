import { WebSocketServer } from "ws";
import { authenticateWS } from "./ws.auth.js";
import { connections } from "./presence.js";
import { publish } from "../services/rabbitmq.service.js";
import { handleClientMessage } from "./ws.handlers.js";
import { config } from "../config/env.js";
import { sendToPlayer } from "../consumers/gameEvents.consumer.js";

const HEARTBEAT_INTERVAL = 30000; // 30s
const MAX_MISSED_PINGS = 2;

export const startWSServer = (server: any) => {
  const wss = new WebSocketServer({
    server,
    path: config.wsPath,
  });

  /* ---------- HEARTBEAT ---------- */
  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      const meta = [...connections.values()].find((c) => c.socket === socket);

      if (!meta) return;

      if (meta.missedPings >= MAX_MISSED_PINGS) {
        console.log("[WS] Terminating dead socket");
        socket.terminate();
        return;
      }

      meta.isAlive = false;
      meta.missedPings += 1;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => clearInterval(interval));

  /* ---------- CONNECTION ---------- */
  wss.on("connection", async (socket, req) => {
    try {
      const url = new URL(req.url!, "http://localhost");
      const token = url.searchParams.get("token") || undefined;

      const playerId = await authenticateWS(token);

      /* ---- RECONNECT LOGIC ---- */
      if (connections.has(playerId)) {
        connections.get(playerId)!.socket.close();

        await publish(config.playerEventsQueue, {
          event: "player_reconnected",
          playerId,
          timestamp: Date.now(),
        });
      } else {
        await publish(config.playerEventsQueue, {
          event: "player_connected",
          playerId,
          timestamp: Date.now(),
        });
      }

      connections.set(playerId, {
        socket,
        isAlive: true,
        missedPings: 0,
      });

      console.log("[WS] Connected:", playerId);

      sendToPlayer(playerId, {
        event: "ws_connected",
        playerId,
        timestamp: Date.now(),
      });

      /* ---- HEARTBEAT RESPONSE ---- */
      socket.on("pong", () => {
        const meta = connections.get(playerId);
        if (!meta) return;

        meta.isAlive = true;
        meta.missedPings = 0;
      });

      /* ---- CLIENT MESSAGES ---- */
      socket.on("message", (data) =>
        handleClientMessage(playerId, data.toString())
      );

      /* ---- DISCONNECT ---- */
      socket.on("close", async () => {
        connections.delete(playerId);

        await publish(config.playerEventsQueue, {
          event: "player_disconnected",
          playerId,
          timestamp: Date.now(),
        });

        console.log("[WS] Disconnected:", playerId);
      });
    } catch (err) {
      console.error("[WS] Authentication failed");
      console.log(err);
      socket.close();
    }
  });
};
