export type PlayerStatus = "OFFLINE" | "IDLE" | "QUEUED" | "IN_GAME";
export type GameSymbol = "X" | "O";
export type BoardCell = "" | GameSymbol;
export type GameResult = "WIN" | "LOSS" | "DRAW";

export type AuthTokenResponse = {
  token: string;
};

export type AuthRefreshResponse = {
  token: string;
};

export type AuthLogoutResponse = {
  message: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type PlayerStats = {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

export type RegisteredPlayer = {
  id: string;
  email: string;
  profile?: Pick<PlayerProfile, "username"> | null;
  stats?: Pick<PlayerStats, "rating"> | null;
};

export type PlayerProfile = {
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type QueueState = {
  position: number | null;
  waitTimeSeconds: number;
};

export type ActiveGameState = {
  matchId: string;
  players: string[];
  board: BoardCell[];
  turn: string;
  mySymbol: GameSymbol;
  status: "ACTIVE" | string;
  version?: number;
  expiresAt: number;
  opponentId?: string;
};

export type CurrentPlayerState = {
  userId: string;
  email: string;
  profile?: PlayerProfile | null;
  stats?: PlayerStats | null;
  rating: number;
  status: PlayerStatus;
  lastOnline?: string | null;
  queue?: QueueState;
  game?: ActiveGameState;
};

export type PlayerSearchItem = {
  id: string;
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  stats?: PlayerStats | null;
  createdAt?: string;
  updateAt?: string;
  lastOnline?: string | null;
};

export type PlayerSearchResponse = {
  data: PlayerSearchItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type PublicPlayerInfo = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  status: PlayerStatus | string;
  rating: number;
  stats?: PlayerStats | null;
  lastOnline?: string | null;
};

export type MatchHistoryItem = {
  matchId: string;
  opponentId: string | null;
  result: GameResult;
  yourSymbol: GameSymbol | null;
  finalBoard: BoardCell[];
  reason: string;
  turnCount: number;
  durationMs: number;
  endedAt: string;
};

export type MatchHistoryResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy: string;
  order: "asc" | "desc";
  data: MatchHistoryItem[];
};

export type MatchDetail = {
  matchId: string;
  players: {
    you: string;
    opponent: string | null;
  };
  symbols: {
    you: GameSymbol;
    opponent: GameSymbol | null;
  };
  firstTurn: string;
  result: GameResult;
  winnerId: string | null;
  reason: string;
  terminationBy?: string | null;
  finalBoard: BoardCell[];
  moves: {
    playerId: string;
    position: number;
    symbol: GameSymbol;
    at: string;
  }[];
  turnCount: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type ConnectSyncMessage = {
  type: "CONNECT_SYNC" | "SYNC_RESPONSE";
  data: Partial<CurrentPlayerState>;
  timestamp?: string;
};

export type QueueJoinedMessage = {
  type: "QUEUE_JOINED";
  data: {
    userId: string;
    rating: number;
    queue: string;
  };
  timestamp?: string;
};

export type QueueLeftMessage = {
  type: "QUEUE_LEFT";
  data: {
    userId: string;
    queue: string;
  };
  timestamp?: string;
};

export type MatchCreatedMessage = {
  type: "MATCH_CREATED";
  data: {
    matchId: string;
    opponentId?: string;
    mode?: string;
  };
  timestamp?: string;
};

export type GameStartedMessage = {
  type: "GAME_STARTED";
  data: {
    recipientId: string;
    matchId: string;
    mySymbol: GameSymbol;
    opponentId: string;
    turn: string;
    expiresAt: number;
  };
  timestamp?: string;
};

export type GameTurnMessage = {
  type: "GAME_TURN";
  data: {
    recipientId: string;
    matchId: string;
    board: BoardCell[];
    nextTurn: string;
    isMyTurn: boolean;
    expiresAt: number;
  };
  timestamp?: string;
};

export type InvalidMoveMessage = {
  type: "INVALID_MOVE";
  data: {
    recipientId: string;
    matchId: string;
    reason: string;
  };
  timestamp?: string;
};

export type GameOverMessage = {
  type: "GAME_OVER";
  data: {
    recipientId: string;
    matchId: string;
    result: GameResult;
    reason: string;
    finalBoard: BoardCell[];
  };
  timestamp?: string;
};

export type ChatMessage = {
  type: "CHAT_MESSAGE";
  data: {
    from: string;
    to: string;
    matchId: string;
    text: string;
    sentAt: string;
  };
  timestamp?: string;
};

export type ChatStatusMessage = {
  type: "chat.status";
  status: "SENT" | "FAILED";
  reason?: "NOT_IN_SAME_MATCH" | "RECIPIENT_OFFLINE" | string;
  matchId: string;
  to: string;
  timestamp?: string;
};

export type AckMessage = {
  type: "ACK";
  data: {
    originalType: string;
    success: boolean;
  };
  timestamp?: string;
};

export type ErrorMessage = {
  type: "ERROR" | "MATCH_ERROR" | "DISCONNECTED";
  data?: string | { reason?: string };
  message?: string;
  timestamp?: string;
};

export type GameSocketMessage =
  | ConnectSyncMessage
  | QueueJoinedMessage
  | QueueLeftMessage
  | MatchCreatedMessage
  | GameStartedMessage
  | GameTurnMessage
  | InvalidMoveMessage
  | GameOverMessage
  | ChatMessage
  | ChatStatusMessage
  | AckMessage
  | ErrorMessage;

export type OutgoingSocketMessage =
  | {
      type: "SYNC_REQUEST";
      payload?: Record<string, never>;
    }
  | {
      type: "GAME_MOVE";
      payload: {
        matchId: string;
        move: {
          position: number;
        };
      };
    }
  | {
      type: "GAME_FORFEIT";
      payload: {
        matchId: string;
      };
    }
  | {
      type: "CHAT";
      to: string;
      matchId: string;
      text: string;
    };

export type FeedItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  symbol?: GameSymbol;
};

export type ChatItem = {
  id: string;
  at: string;
  from: "me" | "opponent" | "system";
  text: string;
  status?: "sent" | "failed" | "pending";
};

