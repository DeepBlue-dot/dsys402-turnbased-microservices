# Matchmaking Service

A resilient, distributed, skill-based matchmaking microservice in the DSYS402 turn-based microservices architecture.

The Matchmaking Service manages player queues, performs skill-based matching (ELO-based search ranges that expand over time), manages atomic match lock creation, and handles match-failure recovery scenarios.

---

## What this service does

* **Matchmaking REST API**: Exposes protected HTTP endpoints for players to join and leave matchmaking queues.
* **ELO-Based Matching**: Matches players based on ELO score proximity in a Redis Sorted Set (`zset`).
* **Dynamic Range Expansion**: Expands the ELO search window the longer a player waits in the queue to balance match quality against queue latency.
* **Distributed Match Locking**: Performs atomic locking during matchmaking using Redis pipelines to prevent double-matching across multiple instances.
* **Self-Healing & Queue Recovery**: Listens to match failures and automatically re-queues online players back to the front of the matchmaking queue.
* **Queue Cleanup on Disconnect**: Automatically evicts players from matchmaking queues upon receiving disconnect events from the gateway.

---

## Technology Stack

* **Node.js + TypeScript**
* **Express** (For API endpoints)
* **Redis (`ioredis`)** for high-throughput queue operations and atomic locking
* **RabbitMQ (`amqplib`)** for decoupled event-driven communication
* **JWT (`jsonwebtoken`)** for HTTP API client authorization

---

## Matchmaking Algorithm & Match Loop

The service runs a background matching loop at a periodic interval (configured at `1500ms` in `src/worker/matchmaker.ts`):

```
                   [ Matchmaking Loop ]
                            |
             Fetch players from Sorted Set queue
                            |
           For each player (Player A, Rating Ra):
            Calculate wait time (Tw = Now - Tjoin)
                            |
           Determine Rating Range (Rdiff):
            - Tw < 10s => Rdiff = 50 ELO
            - 10s <= Tw <= 20s => Rdiff = 100 ELO
            - Tw > 20s => Rdiff = 200 ELO
                            |
         Query Redis Candidates within [Ra - Rdiff, Ra + Rdiff]
                            |
             Did we find a valid partner?
            /                           \
          (Yes)                         (No)
            v                             v
  Atomic Lock (ZREM both)            Check next player
            |
    Success? (Count == 2)
    /                   \
  (Yes)                 (No) -> Another worker claimed a candidate
    v
Publish match.created
```

### Atomic Lock & Failure Rollback

1. **Atomic Lock**: When two players are matched, the service attempts to remove both players from the Redis sorted set `match:queue:ranked` using `redis.zrem(QUEUE_KEY, p1, p2)`. If `zrem` returns `2`, the matchmaking service has successfully claimed both players. If it returns less than `2`, another instance or action has already removed one of the players, and the match is aborted.
2. **Rollback**: If an unexpected exception occurs after locking the players but before completing initialization, the service automatically rolls back both players to the queue, restoring their `QUEUED` presence status and setting their join time `30s` in the past so they return to the front of the queue.

---

## HTTP REST API

All routes are prefixed by Nginx at `/api/matchmaking` (rewritten internally to `/`).

### Authorization

All HTTP endpoints require a bearer token:

```http
Authorization: Bearer <token>
```

---

### 1. Join Matchmaking

* **Route**: `POST /join`
* **Auth Required**: Yes
* **Description**: Enqueues the authenticated player into the ranked matchmaking queue.
* **Pre-conditions**:
  * Player must have an active online presence (checked via Redis `presence:{userId}`).
  * Player cannot be already `QUEUED`.
  * Player cannot be active `IN_GAME`.
* **Response (200 OK)**:
  ```json
  {
    "message": "Joined queue",
    "rating": 1250
  }
  ```

---

### 2. Leave Matchmaking

* **Route**: `POST /leave`
* **Auth Required**: Yes
* **Description**: Removes the authenticated player from the matchmaking queue and updates their presence status back to `IDLE`.
* **Pre-conditions**:
  * Player must be currently in the `QUEUED` state.
* **Response (200 OK)**:
  ```json
  {
    "message": "Left queue"
  }
  ```

---

## Consumed Events (RabbitMQ)

The service consumes events on the queue `matchmaking.events.queue`:

| Event | Payload Fields | Action |
|---|---|---|
| `player.disconnected` | `{ userId: string }` | Evicts the user from `match:queue:ranked` and `match:join_times`. |
| `match.failed` | `{ matchId: string, players: string[], reason: string }` | Checks if players are still online in Redis; if so, updates presence to `QUEUED` and re-queues them with a `30s` queue time bonus. |

---

## Emitted Events (RabbitMQ)

All events are published to the `events` topic exchange.

| Event | Target Routing Key | Description |
|---|---|---|
| `matchmaking.joined.<instanceId>` | Unicast | Notifies the specific Gateway where the player is connected to update their UI. |
| `matchmaking.left.<instanceId>` | Unicast | Notifies the specific Gateway to update the player UI on leave. |
| `match.created.<instanceId>` | Unicast | Notifies the specific Gateway that a match has been created (sent to both player instances). |
| `match.created` | Broadcast | System-wide notification of match creation (consumed by Game Logic service to initialize board state). |

---

## Redis Schema

The service manages the following keys in Redis:

* `match:queue:ranked` (Sorted Set) - Members are `userId` values, and scores are ELO ratings.
* `match:join_times` (Hash) - Fields are `userId` values, and values are epoch milliseconds when the player joined the queue.
* `presence:{userId}` (Hash) - Used to verify player eligibility and read/write the connection status (`QUEUED` / `IDLE`).

---

## Configuration & Environment Variables

Required environment variables:

* `RABBITMQ_URL` - RabbitMQ broker URL.
* `REDIS_URL` - Redis server URL.
* `JWT_SECRET` - JWT secret for validating authentication headers.

Optional environment variables:

* `PORT` - Service HTTP port (defaults to `3000`, mapped to `3001` in docker setup).
* `JWT_EXPIRES_IN` - Expiry string for token validation.

---

## Development & Local Run

### Install Dependencies

```bash
cd services/matchmaking-service
npm install
```

### Build

```bash
npm run build
```

### Start in Dev Mode (Auto-Reload)

```bash
npm run dev
```

### Start in Production Mode

```bash
npm start
```

---

## Troubleshooting & Debugging

1. **Inspect current matchmaking queue**:
   Retrieve the current players waiting in queue along with their ELO ratings:
   ```bash
   docker-compose exec redis redis-cli --raw ZRANGE match:queue:ranked 0 -1 WITHSCORES
   ```

2. **Verify player wait times**:
   List the join timestamps of queued users:
   ```bash
   docker-compose exec redis redis-cli --raw HGETALL match:join_times
   ```

3. **Check Matchmaking logs**:
   ```bash
   docker-compose logs -f matchmaking-service
   ```
   * Key log points:
     * `[Matchmaking] Player <userId> joined queue on <instanceId>`
     * `[Matchmaker] Success: <matchId> | Instances: <instance1>, <instance2>`
     * `[Matchmaking] Cleaning up queue for <userId>` (after disconnect)

---

## Runtime Details & Implementation Notes

This section details the primary implementation files that operate the matchmaking service:

- **Primary implementation files**:
   - [matchmaking.controller.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/matchmaking-service/src/controllers/matchmaking.controller.ts) — HTTP controller handling queue registration and eviction request targets.
   - [matchmaking.service.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/matchmaking-service/src/services/matchmaking.service.ts) — contains the core Redis transaction logic (`joinMatchmaking` & `leaveQueue`).
   - [matchmaker.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/matchmaking-service/src/worker/matchmaker.ts) — the matchmaking worker loop running ELO matching logic and atomic candidate locks (`zrem`).
   - [Event.consumer.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/matchmaking-service/src/consumers/Event.consumer.ts) — handles disconnect-driven queue eviction and match re-queuing on initialization failure.
   - [env.ts](file:///home/bigblue/Projects/web/dsys402-turnbased-microservices/services/matchmaking-service/src/config/env.ts) — contains required environment configurations and RabbitMQ routing keys.

---


## Invariants (Hard Rules)

* **Atomic Queue Updates**: State modifications (presence update + Sorted Set insert + join time write) must always be performed in a Redis pipeline.
* **No Match Creation on Conflict**: If a candidate is locked (removed via `zrem`) but the removal count is `< 2`, the match must be silently aborted.
* **Re-Queue Recovery Boundary**: Players should only be re-queued on `match.failed` if their presence hash still exists in Redis, indicating they are still online.

---

## Operational Recommendations

* **Matchmaker Loop Interval Tuning**: The worker check interval is configured in code to run every `1500ms`. For production environments, this can be externalized to an environment variable to throttle Redis query frequencies.
* **Worker Contention & Horizontal Scaling**: Since matchmaking instances run matching loops independently, scaling the service horizontally creates parallel queries on the same Sorted Set. The atomic `zrem` logic guarantees safety (preventing double matches), but staggered loop intervals or smaller worker pools are recommended to reduce Lock contention.

---

## Philosophy

> Matchmaking is a balancing act between match quality and player patience.
> The service must act as a neutral matchmaker that pairs candidates, claims them atomically, and hands them off immediately.

By delegating active gameplay rules to the Game Logic service and connection concerns to the Gateway, the Matchmaker can focus purely on finding candidates and managing queues.

