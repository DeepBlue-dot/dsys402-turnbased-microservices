import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";
dotenv.config();

const required = (k: string) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k]!;
};

export const config = {
  eventsExchange: "events",
  matchmakingQueue: "matchmaking.events.queue",

  matchmakingRoutingKeys: ["player.created", "player.updated"],

  port: Number(process.env.PORT) || 3000,

  redisUrl: required("REDIS_URL"),

  rabbitmqUrl: required("RABBITMQ_URL"),

  jwtSecret: required("JWT_SECRET"),

  jwtExpiry: (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],
};
