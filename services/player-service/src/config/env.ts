import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 3000,

  databaseUrl: requireEnv("DATABASE_URL"),

  redisUrl: requireEnv("REDIS_URL"),

  rabbitmqUrl: requireEnv("RABBITMQ_URL"),

  eventsExchange: "events",
  playerEventsQueue: "player.events.queue",

  playerRoutingKeys: [
    "player.connected",
    "player.disconnected",
    "player.heartbeat",
    "game.ended",
  ] as const,

  // Auth
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiry: (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],

  bcryptRounds: 10,
};
