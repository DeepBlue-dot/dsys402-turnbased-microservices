# Frontend Application

A modern, responsive, real-time gaming dashboard built with Next.js 16 and Tailwind CSS v4. 

This client application provides a UI for registering and authenticating accounts, searching user profiles, viewing ELO ratings and match history, queuing for matchmaking, and playing real-time Tic-Tac-Toe matches with live opponent chat.

---

## Features

* **User Authentication**: Secure Sign-Up, Log-In, Log-Out flows storing JSON Web Tokens locally.
* **Player Hub & Stats**: Displays current ELO rating, player status (Idle, Queued, In Game), win-loss statistics, and searchable user profiles.
* **Matchmaking Queue Visualizer**: Interactive loading overlay displaying wait times and live queue details.
* **Interactive Game Board**: Real-time 3x3 Tic-Tac-Toe grid with:
  * Local turn verification indicator.
  * Live deadline timers (synced with backend turn deadlines).
  * Draw proposal, acceptance, and decline triggers.
  * Rematch request, acceptance, and decline actions.
  * Immediate forfeit button.
* **Match Chat**: Real-time messaging panel enabling in-game communication with the matched opponent.
* **Match History Explorer**: Detailed list of historical matches played by the user with pagination, sorting, search, board state reviews, move sequences, and game duration counters.
* **Profile Settings**: Account management options allowing users to update their bio, edit email addresses, change passwords, and upload custom avatars (uploaded to MinIO storage).

---

## Technology Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Components**: Customized Radix UI primitives
* **HTTP Client**: Axios with request/response authorization interceptors
* **Real-Time Layer**: Native WebSocket client wrapped in a state-affinity manager

---

## Architecture & Communication Flow

```
                      [ Next.js Client ]
                      /                \
          (REST HTTP Requests)    (WebSocket Protocol)
                    v                    v
              [ API Proxy ]        [ Gateway /ws ]
              /     |     \              |
   Player Service Matchmaking Game  RabbitMQ Event Bus
```

1. **REST APIs**: The client communicates with the backend services through an API routing layer (Nginx proxy). All requests automatically load the bearer token from the local session using request interceptors.
2. **WebSocket Gateway**: For active matchmaking and gameplay, the client opens a persistent connection to the gateway at `/ws` using the current auth token in the query params. All state mutations (making moves, chat, draws) are pushed over the WebSocket connection.

---

## State Synchronization & Socket Manager (`lib/gameSocket.ts`)

The frontend manages a state machine linked to the server's gateway connection:

* **Sync on Connect**: On connection, the client receives a `CONNECT_SYNC` socket message. This instructs the client whether they are currently `OFFLINE`, `IDLE`, `QUEUED`, or `IN_GAME`, allowing graceful page recovery on refresh or browser tab reconnect.
* **Sync Request (`SYNC_REQUEST`)**: If connection drops, the socket manager automatically reconnects and triggers a `SYNC_REQUEST` to pull current active board and turn data from Redis without losing the match state.
* **Heartbeats**: The socket client listens for Gateway `ping` messages and replies with `pong` to keep the connection alive and verify network health.

---

## Environment Variables & Configuration

Create a `.env.local` file in the `services/frontend` directory:

```env
# URL pointing to the Nginx entrypoint proxy (e.g. http://localhost)
NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost
```

---

## Development & Local Run

### Install Dependencies

```bash
cd services/frontend
npm install
```

### Run the Development Server

Start the hot-reloading dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Build and Test Production Bundle

Validate the TypeScript compilation and build production assets:

```bash
npm run build
```

Start the production-ready server:

```bash
npm run start
```

---

## Directory Structure

* `app/` - Next.js App Router folders defining dashboard routes:
  * `dashboard/` - Home screen after logging in (queuing entrypoint).
  * `game/` - Tic-Tac-Toe game board UI.
  * `history/` - Lists personal match logs and detailed views.
  * `login/` / `register/` - Guest authentication routes.
  * `settings/` - Profile modification page.
  * `users/` - Search and view other profiles.
* `components/` - Shared layout components (e.g. `navbar.tsx`) and Radix UI elements.
* `hooks/` - Custom React hooks for active game states.
* `lib/` - Client infrastructure utilities:
  * `api.ts` - REST API client wrapper mapping `/auth`, `/player`, `/matchmaking`, and `/history` methods.
  * `gameSocket.ts` - Core WebSocket client wrapper managing event emitters, message parsing, and reconnection loops.
  * `types.ts` - Shared TypeScript interfaces.
* `services/` - Sub-module configuration wrappers.

---

## Troubleshooting

1. **Authentication Error / Immediate Logout**:
   * Verify your authentication token is valid and hasn't expired. If the server restarts, you may need to log out and register/log in again to clear stale keys.

2. **WebSocket connection closes immediately**:
   * Ensure `event-service` is running and Nginx is proxying `/ws` correctly.
   * Check browser console logs for WebSocket close code `1008` (Unauthorized), which indicates an invalid or missing token.

3. **Images / Avatar Upload failing**:
   * Avatar uploads communicate with MinIO via the `player-service`. Verify that the `minio` container is healthy and `DATABASE_URL` is correct.

---

## Operational Recommendations

* **Build-Time Environment Variables**: `NEXT_PUBLIC_BACKEND_ORIGIN` is baked into the client-side JavaScript bundle during the build step. Make sure this variable is set in your build environment (CI/CD pipelines or local command line) before running `next build`.
* **Stateful Reconnection Handling**: To accommodate mobile browsers and tab switching, the client socket manager listens to document visibility state changes (`visibilitychange` API) and browser online indicators. It triggers a `SYNC_REQUEST` immediately when a tab becomes visible to ensure state alignment.
* **Production Deployment**: For production setups, run Next.js behind Nginx (or a similar ingress/gateway) to route both HTTP `/api` and WebSocket `/ws` traffic under the same domain, which eliminates cross-origin security (CORS) challenges.

---

## Philosophy

> The Frontend is a pure, state-driven visual mirror of the backend domain.
> It holds zero authority over game state, ELO ratings, or queue placements.

By treating the client as a reactive UI that submits commands and renders outcomes validated by backend services, we ensure cheat resistance and consistency across device reconnects.

