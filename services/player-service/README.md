
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


