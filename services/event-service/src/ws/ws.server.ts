import { WebSocketServer } from "ws";
import http from "http";
import { authenticateWS } from "../middleware/auth.middleware.js";
import { AuthenticatedSocket } from "../types/types.js";
import { gatewayService } from "../services/gateway.service.js";
import { config } from "../config/env.js";

export const userSockets = new Map<string, AuthenticatedSocket>();

export const startWSServer = (server: http.Server) => {
  const wss = new WebSocketServer({ server, path: config.wsPath });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;

      if (socket.isAlive === false) {
        console.log(
          `[Watchdog] Terminating non-responsive user: ${socket.userId}`,
        );
        return socket.terminate();
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, 30000); // 30 second pulse

  wss.on("close", () => clearInterval(heartbeatInterval));

  wss.on("connection", async (socket: AuthenticatedSocket, req) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      const payload = authenticateWS(token || undefined);
      const userId = payload.userId;

      const sessionId = crypto.randomUUID();

      socket.userId = userId;
      socket.sessionId = sessionId; // 🔑 Store it
      socket.isAlive = true;
      userSockets.set(userId, socket);

      socket.on("pong", async () => {
        socket.isAlive = true;
        await gatewayService.handleHeartbeat(userId);
      });

      await gatewayService.handleConnect(userId, sessionId);

      const currentState = await gatewayService.handleSyncRequest(userId);
      socket.send(
        JSON.stringify({
          type: "CONNECT_SYNC",
          data: currentState,
        }),
      );

      socket.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const { type, payload } = msg;

          switch (type) {
            case "CHAT":
              await gatewayService.handlePrivateChat(
                userId,
                msg.to,
                msg.matchId,
                msg.text,
              );
              break;

            case "GAME_MOVE":
              await gatewayService.handleGameMove(
                userId,
                payload.matchId,
                payload.move,
              );
              break;

            case "GAME_FORFEIT":
              await gatewayService.handleGameForfeit(userId, payload.matchId);
              break;

            case "SYNC_REQUEST":
              const currentState =
                await gatewayService.handleSyncRequest(userId);
              socket.send(
                JSON.stringify({
                  type: "SYNC_RESPONSE",
                  data: currentState,
                }),
              );
              break;
          }
        } catch (err) {
          /* Malformed JSON */
        }
      });

      socket.on("close", async () => {
        if (socket.wasKicked) {
          console.log(
            `[WS] Session transferred for ${userId}. Local cleanup skipped.`,
          );
          return;
        }
        if (userSockets.get(userId) === socket) {
          userSockets.delete(userId);
          await gatewayService.handleDisconnect(userId);
        }
      });

      socket.on("error", (err) => {
        console.error(`[WS] Error ${userId}:`, err.message);
        socket.terminate();
      });
    } catch (err: any) {
      socket.close(1008, "Unauthorized");
    }
  });
};
export const sendToUser = (userId: string, payload: any) => {
  const socket = userSockets.get(userId);

  if (socket && socket.readyState === 1) {
    // Add timestamp to payload
    const payloadWithTimestamp = {
      ...payload,
      timestamp: new Date().toISOString(),
      // or use milliseconds: Date.now()
    };
    
    socket.send(JSON.stringify(payloadWithTimestamp));
    return true;
  }

  return false;
};
