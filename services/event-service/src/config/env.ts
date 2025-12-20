import dotenv from "dotenv";

dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 4000,

  rabbitmqUrl: required("RABBITMQ_URL"),

  playerEventsQueue:
    process.env.PLAYER_EVENTS_QUEUE || "player_events",

  gameEventsQueue:
    process.env.GAME_EVENTS_QUEUE || "game_events",

  playerMoveQueue:
    process.env.PLAYER_MOVE_QUEUE || "player_moves",

  playerServiceUrl: required("PLAYER_SERVICE_URL"),

  wsPath: process.env.WS_PATH || "/ws",
};
