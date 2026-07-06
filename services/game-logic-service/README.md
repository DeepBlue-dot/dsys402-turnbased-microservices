# game-logic-service

A dedicated backend microservice for turn-based game logic in the DSYS402 turn-based microservices project.

The service receives game and presence events from RabbitMQ, manages active match state in Redis, persists completed match history to MongoDB, and exposes authenticated match history endpoints through Express.

## What this service does

- consumes RabbitMQ commands and lifecycle events
- initializes Tic-Tac-Toe matches on `match.created`
- validates and executes `game.cmd.move` commands
- processes `game.cmd.forfeit` and `player.disconnected` outcomes
- tracks active match state and turn deadlines in Redis
- archives completed matches to MongoDB
- serves authenticated history lookups via HTTP

## Technology stack

- Node.js + TypeScript
- Express
- RabbitMQ (`amqplib`)
- Redis (`ioredis`)
- MongoDB / Mongoose
- JWT auth for HTTP access

## Runtime flow

### Startup sequence

1. load environment config from `.env`
2. connect to RabbitMQ and assert `events` exchange + `logic.queue`
3. bind the queue to required routing keys
4. start event consumption and watchdog timer loop
5. connect to MongoDB
6. start the Express server on `PORT`

### Event-driven behavior

The service listens on RabbitMQ queue `logic.queue` for these event types:

- `match.created`
- `game.cmd.move`
- `game.cmd.forfeit`
- `player.disconnected`

Each message is expected to follow the shared event shape:

```json
{
  "type": "event.type",
  "data": { ... },
  "occurredAt": "2026-07-06T..."
}
```

### Published events

This service publishes events back to the `events` exchange using both shared and instance-specific routing keys:

- `game.event.started.<instanceId>` — match started message for a specific game instance
- `game.event.turn.<instanceId>` — turn update when the board advances
- `game.event.invalid.<instanceId>` — invalid command or bad move notification
- `match.ended.<instanceId>` — match termination notice to connected players
- `match.ended` — broadcast match ended summary
- `match.failed` — failure to initialize a match

The `instanceId` is generated from `INSTANCE_ID` or the host name plus a random suffix.

## Active game state in Redis

This service uses Redis for active match state and timers. Key patterns used:

- `game:match:<matchId>` — hash containing current board, players, turn, symbols, moves, status, and expiry
- `player:match_map:<userId>` — string mapping a player to their active match ID
- `presence:<userId>` — hash tracking player connection status, instanceId, and current match
- `game:timers` — sorted set of deadlines for turn expiry

### Redis lifecycle

- `initializeGame()` writes the match hash, player mappings, and presence entries
- `processMove()` updates the board and reschedules the turn timer
- `endGame()` removes the match state, timer entry, and player match mappings
- `handlePlayerDisconnect()` and timeout handling both end the match with a forfeit

## Match persistence in MongoDB

Completed games are saved to MongoDB using the `MatchHistory` model.

Stored fields include:

- `matchId`
- `players`
- `winnerId`
- `symbols`
- `firstTurn`
- `finalBoard`
- `moves`
- `turnCount`
- `reason` (`COMPLETED`, `FORFEIT`, `TIMEOUT`)
- `terminationBy` (present on schema but currently optional)
- `startedAt`
- `endedAt`
- `durationMs`

## HTTP API

The service exposes history endpoints under the root path:

- `GET /me` — returns paginated match history for the authenticated user
- `GET /:matchId` — returns full match details for a match the authenticated user participated in

### Authorization

Requests require a bearer token:

```http
Authorization: Bearer <token>
```

The token is verified using `JWT_SECRET`, and the user ID is read from the JWT payload.

### `GET /me` query parameters

- `page` — page number (default `1`)
- `limit` — page size (default `20`, max `50`)
- `sortBy` — one of `endedAt`, `durationMs`, or `turnCount` (default `endedAt`)
- `order` — `asc` or `desc` (default `desc`)
- `result` — filter by `WIN`, `LOSS`, or `DRAW`
- `reason` — filter by `COMPLETED`, `FORFEIT`, or `TIMEOUT`
- `search` — partial match against `matchId` or opponent ID
- `from` / `to` — ISO date range filter for when the match ended

### Response shape for `GET /me`

```json
{
  "page": 1,
  "limit": 20,
  "total": 5,
  "totalPages": 1,
  "sortBy": "endedAt",
  "order": "desc",
  "data": [
    {
      "matchId": "abc123",
      "opponentId": "userB",
      "result": "WIN",
      "yourSymbol": "X",
      "finalBoard": ["X","O","X",...,""],
      "reason": "COMPLETED",
      "turnCount": 5,
      "durationMs": 45000,
      "endedAt": "2026-07-06T..."
    }
  ]
}
```

### Response shape for `GET /:matchId`

Returns the full match record, including symbol mapping, move history, and final board state.

## Configuration

Required environment variables:

- `REDIS_URL`
- `MONGO_URI`
- `RABBITMQ_URL`
- `JWT_SECRET`

Optional environment variables:

- `PORT` — HTTP port, default `3003`
- `MONGO_DB_NAME` — MongoDB database name, default `tictactoe_db`
- `TURN_TIMEOUT_SEC` — seconds before a turn expires, default `80`
- `INSTANCE_ID` — optional explicit instance identity for event routing
- `WATCHDOG_INTERVAL_MS` — interval for timeout scanning (configured as `watchdogIntervalMs` in code)

## Development and local run

Install dependencies and build:

```bash
cd services/game-logic-service
npm install
npm run build
```

Run locally:

```bash
npm start
```

Run in development mode:

```bash
npm run dev
```

Run the full repo with Docker Compose:

```bash
cd /home/bigblue/Projects/web/dsys402-turnbased-microservices
docker compose up --build
```

## Notes

- This service is not the public game client API; it is the backend game engine and state manager.
- Active games are kept in Redis and only archived to MongoDB after the match ends.
- The watchdog loop uses a sorted set for reliable timeout ownership across instances.
- Invalid moves are handled by publishing `game.event.invalid.<instanceId>` events instead of modifying state.

## Service structure

Key source folders:

- `src/app.ts` — service bootstrap and server startup
- `src/config/env.ts` — environment config, instance ID, and routing keys
- `src/consumers/Event.consumer.ts` — event dispatch to game logic
- `src/services/game.service.ts` — core game lifecycle logic
- `src/services/rabbitmq.service.ts` — RabbitMQ connect/consume/publish logic
- `src/worker/watchdog.worker.ts` — timer-based timeout processing
- `src/routes/MatchHistory.routes.ts` — authenticated history routes
- `src/controllers/history.controller.ts` — history query handling
- `src/models/MatchHistory.model.ts` — MongoDB persistence schema
