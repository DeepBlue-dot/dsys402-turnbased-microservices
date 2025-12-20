import dotenv from "dotenv";
dotenv.config();

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

export const config = {
  rabbitmqUrl: required("RABBITMQ_URL"),
  mongoUri: required("MONGO_URI"),
  disconnectGraceMs: Number(process.env.DISCONNECT_GRACE_MS) || 60000,

  matchCreatedQueue: "match_created",
  playerMoveQueue: "player_moves",
  playerEventsQueue: "player_events",
  gameEventsQueue: "game_events",
};
