# Event Service (WebSocket Gateway)

A high-performance, stateless WebSocket gateway in the DSYS402 turn-based microservices architecture. 

The Event Service serves as the sole entry point for real-time player connections. It handles authentication, maps active WebSocket connections, publishes client actions as events to RabbitMQ, and routes service-emitted events back to the appropriate connected clients.

---

## What this service does

* **WebSocket Gateway**: Maintains persistent, low-latency TCP connections with active game clients.
* **Protocol Translation**: Translates client WebSocket payloads (e.g. `GAME_MOVE`, `CHAT`) into backend-facing RabbitMQ routing keys (e.g. `game.cmd.move`, `chat.private.*`).
* **JWT Authentication**: Validates client access tokens during the WebSocket upgrade request.
* **Targeted Event Delivery (Unicast & Broadcast)**: Delivers backend events (`game.event.turn`, `match.created`, etc.) directly to connected players.
* **Session Management**: Integrates session IDs and connection heartbeats to manage player connection states.
* **Session Hijacking Protection**: Kicks old connection instances if a player logs in from a new device/browser tab.
* **Zero-Trust Private Chat routing**: Safely validates that players are in the same active match in Redis before routing messages.

---

## Technology Stack

* **Node.js + TypeScript**
* **ws** (High-performance WebSocket library)
* **Express** (For health check endpoints)
* **RabbitMQ (`amqplib`)**
* **Redis (`ioredis`)**
* **JWT (`jsonwebtoken`)** for WebSocket authentication

---

## Runtime Flow & Gateway Scaling

### Startup Sequence

1. Load configuration from `.env`.
2. Generate a stable per-gateway `INSTANCE_ID` (either from environment variable or `hostname` + random hash).
3. Connect to RabbitMQ, assert the `events` topic exchange, and initialize a gateway-owned, exclusive, temporary queue (`gateway.queue.<instanceId>`).
4. Bind the gateway queue to system-wide broadcast routing keys (e.g. `player.kick`) and the instance-specific unicast pattern (`*.#.<instanceId>`).
5. Establish connection to Redis (used for state-affinity and matching verification).
6. Start WebSocket server on `/ws` using the Express-hosted HTTP server port.

### Stateless Scaling Model (State-Affinity)

The system supports horizontal gateway scaling by dynamically routing unicast events using RabbitMQ topic keys:

```
                  [ Game Clients ]
                   /            \
           (WS to GW-1)      (WS to GW-2)
                 v                v
          [ Gateway-1 ]      [ Gateway-2 ]
                 \                /
                  v              v
        ------------------------------------
        |       RabbitMQ (Event Bus)       |
        ------------------------------------
           /                            \
          v                              v
  [ Player Service ]             [ Game Service ]
```

1. **Unicast Routing**: When a player connects to a specific gateway instance (e.g. `Gateway-1`), the gateway sets the player's presence metadata in Redis with its own `instanceId`.
2. **Targeted Delivery**: When downstream services (like `game-logic-service`) publish events targeting a player, they fetch the player's current gateway `instanceId` from Redis and publish to RabbitMQ with a routing key suffix: `<event_type>.<instanceId>` (e.g. `game.event.turn.gateway-abc123`).
3. **Consumption**: Only the gateway instance matching the routing key suffix consumes the event from RabbitMQ and delivers it to the client via their local WebSocket connection.

---

## Consumed WebSocket Messages (Client -> Server)

Clients send messages in JSON format: `{ "type": "TYPE", "payload": { ... } }`.

| Type | Payload Fields | Backend Action / RabbitMQ Event |
|---|---|---|
| `CHAT` | `to`, `matchId`, `text` | Validates players are in same match, publishes `chat.private.<recipientInstanceId>` |
| `GAME_MOVE` | `matchId`, `move: { position: string }` | Publishes `game.cmd.move` |
| `GAME_FORFEIT` | `matchId` | Publishes `game.cmd.forfeit` |
| `GAME_DRAW_PROPOSE` | `matchId` | Publishes `game.cmd.draw_propose` |
| `GAME_DRAW_CONFIRM` | `matchId` | Publishes `game.cmd.draw_confirm` |
| `GAME_DRAW_DECLINE` | `matchId` | Publishes `game.cmd.draw_decline` |
| `REMATCH_REQUEST` | `matchId` | Publishes `game.cmd.rematch_request` |
| `REMATCH_DECLINE` | `matchId` | Publishes `game.cmd.rematch_decline` |
| `SYNC_REQUEST` | None | Performs inline Redis lookup, returns `SYNC_RESPONSE` to client |

---

## Emitted WebSocket Messages (Server -> Client)

The Gateway publishes JSON messages back to clients. Every payload automatically receives a `timestamp` field in ISO string format.

| WebSocket Type | Description |
|---|---|
| `CONNECT_SYNC` | Sent upon initial WebSocket connection containing the player's current state. |
| `ACK` | Acknowledges receipt and process status of a client command. |
| `SYNC_RESPONSE` | Response payload from a client `SYNC_REQUEST`. |
| `MATCH_CREATED` | Sent when a player has been successfully matched with an opponent. |
| `GAME_STARTED` | Dispatched to players when a game board/session starts. |
| `GAME_TURN` | Updates players with the new board state, next turn, and deadline. |
| `GAME_DRAW_PROPOSED` | Sent to the opponent when a draw has been proposed. |
| `GAME_DRAW_DECLINED` | Sent to the proposer when a draw has been declined. |
| `INVALID_MOVE` | Notifies the active player that their move was illegal or out of turn. |
| `GAME_OVER` | Dispatched when the match ends (WIN, LOSS, DRAW, FORFEIT, TIMEOUT). |
| `PLAYER_RATING_UPDATED` | Sent after rating changes are calculated post-game. |
| `REMATCH_STATUS` | Updates players on rematch requests. |
| `REMATCH_EXPIRED` | Sent if a rematch request expires. |
| `QUEUE_JOINED` / `QUEUE_LEFT`| Sent on changes to matchmaking queue states. |
| `DISCONNECTED` | Sent if a session is kicked by a newer login. |
| `ERROR` | Sent on payload verification failures or exceptions. |

---

## Infrastructure Interactions & Redis Usage

The Gateway interacts with Redis to handle state synchronization and zero-trust verification:

* `presence:{userId}` (Hash) - Reads player connection status, rating, and matching `instanceId`. Sets/expires fields on connection lifecycle events.
* `player:match_map:{userId}` (String) - Reads the active `matchId` for a player. Used to block private messages between players who are not in the same active game.
* `game:match:{matchId}` (Hash) - Reads current active board, player symbols, turn, and timeouts to fulfill state synchronization on client connections/sync requests.
* `game:rematch:{lastMatchId}` (Hash) - Reads active rematch requests.

---

## REST HTTP API

Exposes a simple unauthenticated port for health monitoring:

* `GET /health` - Returns JSON response with `gateway-service` uptime, health status, and gateway host timestamp.

---

## Configuration / Environment Variables

The service loads the following keys:

* `RABBITMQ_URL` - RabbitMQ connection URI (e.g. `amqp://guest:guest@localhost:5672`).
* `REDIS_URL` - Redis connection URL (e.g. `redis://localhost:6379`).
* `JWT_SECRET` - Shared secret used to verify JWT bearer signatures.
* `WS_PATH` - WebSocket upgrade route pathname (defaults to `/ws`).
* `PORT` - Port to host HTTP health routing and WebSocket connection (defaults to `4000`).
* `INSTANCE_ID` - (Optional) Overrides automatic random host-scoped identifier generation.
* `JWT_EXPIRES_IN` - (Optional) Expiry token configuration.

---

## Development & Local Run

### Install Dependencies

```bash
cd services/event-service
npm install
```

### Build the Service

```bash
npm run build
```

### Run Locally (Dev Mode with Auto-Reload)

Make sure you have local Redis and RabbitMQ running, and `.env` configured:

```bash
npm run dev
```

### Run in Production Mode

```bash
npm start
```

---

## Troubleshooting & Debugging

When investigating gateway, connection, or event routing issues, use the following techniques:

1. **Watch Gateway logs** for client lifecycle traces and connection changes:
   ```bash
   docker-compose logs -f event-service
   ```
   * Useful log patterns:
     * `[Gateway] Service running on port <port>`
     * `[WS] Session transferred for <userId>. Local cleanup skipped.` (indicates session kick/hijacking protection triggered)
     * `[EVENT] <routingKey>` (logged when gateway publishes a client action to RabbitMQ)

2. **Verify active sockets** connected to the local instance by examining `userSockets` mapping length if running debugger.

3. **Check RabbitMQ bindings** on the management console (`http://localhost:15672`) under the **Queues** tab. Look for `gateway.queue.<instanceId>` and verify it has the routing key bindings `*.#.<instanceId>` and `player.kick` on the `events` exchange.

---

## Invariants (Hard Rules)

* **No direct DB writes**: The Event Service does not read or write to PostgreSQL or MongoDB. All persistent database transactions must go through the respective domain service (Player Service / Game Logic).
* **Exclusive Gateway Queues**: Each Gateway instance queue is set to `exclusive: true` and will be automatically purged by RabbitMQ when the service instance terminates.
* **Bearer Token Validation**: Every connection request must include a valid `token` search parameter; connections with missing, corrupted, or expired tokens will be immediately rejected with a `1008 Unauthorized` code.

---

## Operational Recommendations

* **File Descriptor Limits**: Since WebSocket gateways maintain long-lived persistent TCP connections, they consume system file descriptors. Ensure that system-level limits (`ulimit -n`) and container limits (such as the `nofile` configuration in Docker/Kubernetes) are set high enough to accommodate the maximum concurrent player capacity (e.g., `20,000` or higher).
* **Load Balancer Configuration**: Your ingress controller or load balancer (e.g., NGINX) must support WebSocket upgrades (`Upgrade` and `Connection` headers) and should be configured with a long write/read timeout (e.g., `3600s`) to prevent premature connection termination of idle players.
* **Horizontal Scaling & Discovery**: When deploying replicas, use an exchange-bound queue with a unique suffix (like the default `gateway.queue.<instanceId>`) to facilitate state-affinity routing via RabbitMQ routing keys.

---

## Philosophy

> The WebSocket Gateway is the sensory system of the backend.
> It must remain thin, fast, and completely stateless beyond the local socket connection registry. 

By keeping business logic inside the Game Logic service and player status rules inside the Player Service, the gateway can scale horizontally without complex synchronization or distributed locks.

