# Real-Time Multiplayer Game Backend

A production-grade, event-driven backend architecture for real-time and turn-based multiplayer games.
Designed for scalability, fault tolerance, and clean domain separation.

This system is suitable for games such as:

* Tic-Tac-Toe / Chess / Checkers
* Turn-based strategy games
* Real-time competitive games (with different state models)

---

## Architecture Overview

The system is built as a set of decoupled microservices communicating through events.

```
Clients
   |
WebSocket Gateway
   |
RabbitMQ (Event Bus)
   |
------------------------------------------------
| Player Service | Matchmaking | Game Service |
------------------------------------------------
   |
Redis (Hot State)
   |
MongoDB (Persistent State)
```

### Core Principles

* **Single responsibility per service**
* **Event-driven communication**
* **Redis for real-time state**
* **MongoDB for persistence**
* **Stateless services**
* **Horizontal scalability**

---

## Services

### 1. WebSocket Gateway

Responsible for:

* WebSocket connections
* JWT authentication
* Message validation
* Publishing events to RabbitMQ
* Pushing events to connected clients

It does **not** own business logic or domain state.

---

### 2. Player Service

Owns:

* Player profiles
* Ratings / ELO
* Presence (online, offline, in-game)
* Reconnection handling

Acts as the **single authority** for player state.

---

### 3. Matchmaking Service

Responsible for:

* Player queues
* Skill-based matching
* Match creation
* Queue timeouts

Produces:

* `match.created`
* `match.cancelled`

---

### 4. Game Service

Owns:

* Game rules
* Turn validation
* Win / lose / draw logic
* Timers
* State transitions

Uses Redis for atomic game state and MongoDB for history.

---

## Data Storage

### Redis (Hot State)

Used for:

* Active game state
* Player presence
* Timers
* Queues

Patterns:

* Hashes for state
* Sorted sets for timers
* Lua scripts for atomic moves
* TTL for cleanup

### MongoDB (Cold State)

Used for:

* Match history
* Player statistics
* Replay data
* Auditing

---

## Event System

All services communicate via RabbitMQ.

### Example Events

```
player.connected
player.disconnected
match.created
match.ended
game.cmd.move
game.event.turn
```

Events are:

* Immutable
* Idempotent
* At-least-once delivery

Each event includes:

```json
{
  "eventId": "uuid",
  "type": "game.cmd.move",
  "timestamp": 123456789,
  "payload": { ... }
}
```

---

## Game Flow

1. Player connects → `player.connected`
2. Player joins queue → `matchmaking.enqueue`
3. Match created → `match.created`
4. Game initialized in Redis
5. Players send moves → `game.cmd.move`
6. Game Service validates + updates
7. State broadcast → `game.event.turn`
8. Match ends → `match.ended`
9. Results saved to MongoDB
10. Ratings updated

---

## Fault Tolerance

The system is resilient to:

* Service restarts
* Network partitions
* Duplicate events
* Client disconnects

Mechanisms:

* Redis TTL cleanup
* Event idempotency
* Dead-letter queues
* Reconnection windows
* Stateless services

---

## Scalability

Every component can scale horizontally:

| Component | Scaling                 |
| --------- | ----------------------- |
| Gateway   | WebSocket sharding      |
| RabbitMQ  | Clustered               |
| Services  | Stateless replicas      |
| Redis     | Cluster                 |
| MongoDB   | Replica sets / sharding |

Supports:

* Tens of thousands of concurrent players
* Millions of events per day

---

## Security

* JWT authentication
* No direct client → service access
* All state changes go through Game Service
* Rate limiting on Gateway
* Event validation on consumers

---

## Local Development

### Requirements

* Docker
* Docker Compose
* Node.js / Go / Python (depending on implementation)

### Start Everything

```bash
docker-compose up
```

Services:

* Gateway → `ws://localhost:8080/ws`
* RabbitMQ → `localhost:5672`
* Redis → `localhost:6379`
* MongoDB → `localhost:27017`

---

## Example WebSocket Message

### Client → Server

```json
{
  "type": "GAME_MOVE",
  "data": {
    "matchId": "abc123",
    "move": "A1"
  }
}
```

### Server → Client

```json
{
  "type": "GAME_STATE",
  "data": {
    "board": ["X", "", "O"],
    "turn": "player2"
  }
}
```

---

## Design Goals

This project prioritizes:

* Correctness over shortcuts
* Explicit domain ownership
* Observability
* Real-world failure modes
* Clean scaling paths

This is **not** a toy architecture.
It is designed to survive production.

---

## Future Improvements

* Spectator service
* Match replays
* Analytics pipeline
* Anti-cheat detection
* Regional matchmaking
* Federation / cross-cluster play

---

## Who This Is For

This backend is ideal for:

* Indie multiplayer games
* Competitive platforms
* Real-time learning apps
* Multiplayer simulations
* Game backend experimentation

---

## Philosophy

> Real-time systems fail in silence.
> This architecture is built to fail loudly, recover automatically, and scale predictably.

---

## License

MIT / Apache 2.0 (your choice)

---

## Final Note

This project demonstrates a **real distributed system**, not just a game.

If you understand and can implement this architecture, you are already operating at a **professional backend engineer level**.
