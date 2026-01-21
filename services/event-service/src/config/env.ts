import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";
import os from "os";
import crypto from "crypto";
dotenv.config();

const required = (k: string) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k]!;
};

const instanceId = `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`;

export const config = {
  eventsExchange: "events",

  gatewayQueue: `gateway.queue.${instanceId}`,

  gatewayRoutingKeys: [
    "match.strarted", 
    "player.kick",
    "chat.private"
  ],

  port: Number(process.env.PORT) || 4000,
  redisUrl: required("REDIS_URL"),
  rabbitmqUrl: required("RABBITMQ_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiry: (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],
  wsPath: required("WS_PATH"),
};