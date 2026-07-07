
# Player Service

The Player Service is the **single source of truth for all player-related data and state** in the system.

It owns:

* Player identity
* Ratings / ELO
* Presence (online, offline, in-game)
* Reconnection logic
* Heartbeats

No other service is allowed to directly modify player state.

---

## Responsibilities

The Player Service is responsible for:

* Creating and managing player profiles
* Tracking player presence in real time
* Handling connect / disconnect events
* Managing reconnection windows
* Updating ratings after matches
* Emitting authoritative player events

---

## Domain Ownership

This service **fully owns** the following domains:

| Domain     | Description                |
| ---------- | -------------------------- |
| Identity   | User ID, username          |
| Presence   | Online / offline / in-game |
| Rating     | ELO / MMR                  |
| Status     | Idle, queued, playing      |
| Heartbeats | Connection liveness        |

Other services may **request** changes, but only Player Service can **write** them.

---

## Data Storage

### Redis (Hot State)

Used for:

* Player presence
* Active sessions
* Heartbeat timestamps

Example keys:

```
presence:{playerId}
session:{playerId}
heartbeat:{playerId}
```

Example presence:

```json
{
  "status": "IN_GAME",
  "matchId": "abc123",
  "lastSeen": 123456789
}
```

### MongoDB (Persistent State)

Used for:

* Player profiles
* Ratings
* Match history references

Example document:

```json
{
  "_id": "player123",
  "username": "neo",
  "rating": 1420,
  "gamesPlayed": 87,
  "wins": 42
}
```

---

## Consumed Events

The Player Service listens to the following events:

| Event               | Purpose                 |
| ------------------- | ----------------------- |
| player.connected    | Client connected        |
| player.disconnected | Client disconnected     |
| match.created       | Mark players as in-game |
| match.ended         | Update ratings          |
| player.heartbeat    | Update liveness         |

---

## Produced Events

The Player Service emits:

| Event                   | Description              |
| ----------------------- | ------------------------ |
| player.presence.updated | Presence change          |
| player.reconnected      | Player recovered         |
| player.timed_out        | Reconnect window expired |
| player.rating.updated   | Rating changed           |

---

## Presence Model

Presence is authoritative and centralized.

Possible states:

```
OFFLINE
ONLINE
QUEUED
IN_GAME
DISCONNECTED
```

State transitions are controlled only by Player Service.

Example:

```
ONLINE → QUEUED → IN_GAME → DISCONNECTED → ONLINE
```

---

## Reconnection Logic

When a player disconnects:

1. Mark as `DISCONNECTED`
2. Start reconnect timer (e.g. 30s)
3. If player reconnects → restore session
4. If timeout → emit `player.timed_out`

This prevents:

* Accidental forfeits
* Network glitches killing matches

---

## Rating Updates

After receiving `match.ended`:

1. Fetch both players
2. Calculate new ratings
3. Persist to MongoDB
4. Emit `player.rating.updated`

Ratings are **never updated elsewhere**.

---

## Idempotency

All consumed events must include:

```
eventId
```

The Player Service keeps:

```
processed:{eventId}
```

Duplicate events are ignored.

This prevents:

* Double rating updates
* Duplicate disconnects
* Corrupted presence

---

## API (Internal)

The Player Service does not expose public APIs.
It communicates only via:

* RabbitMQ events
* Redis state

Other services must never modify Redis player keys directly.

---

## Failure Handling

The service is resilient to:

* Duplicate events
* Service restarts
* Redis reconnections
* MongoDB failovers

Using:

* Event idempotency
* Redis TTL
* Stateless workers

---

## Scaling

The Player Service is horizontally scalable.

You can safely run:

```
N replicas
```

Because:

* No in-memory state
* Redis is shared
* Events are idempotent

---

## Security Model

* Does not trust Gateway blindly
* Validates all incoming events
* Rejects illegal state transitions
* Owns all writes to player state

---

## Monitoring

Important metrics:

* Online player count
* Active sessions
* Reconnection success rate
* Rating update latency
* Redis error rate

---

## Example Flow

### Player Connects

1. Gateway emits `player.connected`
2. Player Service:

   * Sets presence to `ONLINE`
   * Emits `player.presence.updated`

### Player Disconnects During Match

1. Gateway emits `player.disconnected`
2. Player Service:

   * Sets presence to `DISCONNECTED`
   * Starts reconnect timer

### Player Reconnects

1. Gateway emits `player.connected`
2. Player Service:

   * Restores `IN_GAME`
   * Emits `player.reconnected`

---

## Invariants (Hard Rules)

These rules must never be broken:

* No other service writes to `presence:*`
* No direct client → Player Service access
* Ratings updated only after `match.ended`
* All events are idempotent

If any of these are violated, bugs will happen.

---

## Philosophy

> Player Service is the identity layer of the entire system.
> If it lies, everything else collapses.

This service must be:

* Boring
* Predictable
* Strict
* Extremely reliable

Because every other service depends on it.

---

## Runtime Details & Implementation Notes

This section explains the runtime behavior, important Redis keys, event contracts, background workers, and configuration knobs so engineers can debug and operate the service.

- Primary implementation files:
   - [Events.consumer.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/player-service/src/consumers/Events.consumer.ts) — event handlers for `player.connected`, `player.disconnected`, `player.heartbeat`, and `match.ended` (also contains Elo update logic).
   - [janitor.worker.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/player-service/src/worker/janitor.worker.ts) — presence janitor that increments `missedHeartbeats` and emits `player.disconnected` when unresponsive.
   - [player.controller.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/player-service/src/controllers/player.controller.ts) — HTTP controller for `GET /me` and responses that surface live presence and in-game state.
   - [env.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/player-service/src/config/env.ts) — required environment variables and routing keys.

### Key Redis Keys

The service uses Redis for hot state and coordination. Important keys:

- `presence:{userId}` (hash) — authoritative per-player presence fields: `userId`, `status`, `instanceId`, `rating`, `missedHeartbeats`, `matchId` (if in-game), `expiresAt`, etc.
- `player:match_map:{userId}` (string) — quick mapping from player → active `matchId` when in-game.
- `online_players` (set) — set of currently connected user IDs used by the janitor.

Example: `HGETALL presence:<userId>` will show `status`, `missedHeartbeats`, and `instanceId`.

### Event Contracts (consumed)

- `player.connected` — payload: `{ userId: string, instanceId: string }`.
   - Action: load player data, set `presence:{userId}` fields (`status` becomes `IDLE` / preserved `IN_GAME`/`QUEUED`), add to `online_players` set.

- `player.disconnected` — payload: `{ userId: string }`.
   - Action: remove `presence:{userId}`, remove from `online_players`, persist `lastOnline` to the player record.

- `player.heartbeat` — payload: `{ userId: string }`.
   - Action: if user is in `online_players`, reset `missedHeartbeats` to `0` on `presence:{userId}`.

- `match.ended` — payload: `{ matchId: string, players: string[], winnerId: string | null, reason: string }`.
   - Action: apply Elo updates (unless draw), persist `MatchHistory`/stats, and optionally sync `presence:{playerId}` ratings.

### Janitor / Heartbeat Policy

- File: `src/worker/janitor.worker.ts`.
- Behavior: a periodic sweep (`JANITOR_INTERVAL`, currently 20000ms) iterates `online_players` and atomically increments `missedHeartbeats` on each `presence:{userId}`. When `missedHeartbeats >= STRIKE_THRESHOLD` (currently `4`) the janitor emits `player.disconnected` for that user.
- Effect: other services (matchmaking, game logic) will react to `player.disconnected` (for example to forfeit or archive matches). This protects against network partitions and client silence.

Tuning knobs to consider:
- `STRIKE_THRESHOLD` — how many missed heartbeats before eviction (default `4`). Lower = faster eviction; higher = more tolerant.
- `JANITOR_INTERVAL` — how often the janitor scans the `online_players` set (default `20000` ms).

### `GET /me` behavior (developer-facing)

- `GET /api/player/me` returns the combined canonical player profile plus live presence and (if present) an `game` object read from Redis using `player:match_map:{userId}`.
- If Redis contains a `game:match:{matchId}` record, the controller returns `game.expiresAt` as a number (milliseconds since epoch) and other live fields used by the frontend to show timers and board state.
- The controller performs a small self-heal: if `player:match_map` points to a missing game key, it clears the mapping and sets the player's presence to `IDLE`.

## Configuration / Environment

Required environment variables (see `src/config/env.ts`):

- `DATABASE_URL` — Postgres/Prisma URL
- `REDIS_URL` — Redis connection string
- `RABBITMQ_URL` — RabbitMQ broker URL
- `JWT_SECRET` — JWT secret for tokens used across the system

Other constants live in code (not yet externalized): `STRIKE_THRESHOLD = 4`, `JANITOR_INTERVAL = 20000` (ms).

## Troubleshooting & Debugging Commands

When investigating presence, forfeit, or reconnection issues, these commands are useful (run from project root):

1) Watch logs from related services:

```bash
docker-compose logs -f player-service event-service game-logic-service
```

Look for these log lines:
- `[Presence] <username> is now IDLE` — successful connect
- `[Janitor] Evicting unresponsive player: <userId>` — janitor triggered disconnect
- `[Presence] <userId> disconnected and archived` — graceful disconnect handled

2) Inspect Redis presence data for a specific user:

```bash
docker-compose exec redis redis-cli --raw HGETALL presence:<userId>
```

3) Check whether a match timer is expired (used by game logic watchdog):

```bash
docker-compose exec redis redis-cli --raw ZSCORE game:timers <matchId>
```

If `ZSCORE` <= current unix ms (Date.now()), the watchdog may claim the timer and call `endGame` (TIMEOUT).

4) Simulate a heartbeat (send event) — useful for local dev if you have a helper script or can publish to RabbitMQ. After publishing `player.heartbeat`, verify `missedHeartbeats` becomes `0`.

## Operational Recommendations

- Expose `STRIKE_THRESHOLD` and `JANITOR_INTERVAL` as environment variables in production so tuning is possible without code changes.
- Monitor `missedHeartbeats` distribution and `player.disconnected` rates to identify network flap problems or overloaded gateways.
- When investigating an unexpected immediate `GAME_OVER` event, inspect the `GAME_STARTED` `expiresAt` payload from the gateway and the Redis `ZSCORE` for `game:timers` to confirm unit mismatches (ms vs seconds) or a timer already expired.

---

If you'd like, I can open a PR that: (1) exposes janitor tuning via env vars, and (2) adds a small admin endpoint to inspect `presence:*` keys for debugging. Tell me which you'd prefer next.


