import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";
import os from "os";
import crypto from "crypto";

dotenv.config();

const required = (k: string) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k]!;
};

// Stable per-gateway identity (State-Affinity)
const instanceId =
  process.env.INSTANCE_ID ??
  `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`;

export const config = {
  // 🔑 Gateway Identity
  instanceId,

  // 📨 RabbitMQ
  eventsExchange: "events",
  gatewayQueue: `gateway.queue.${instanceId}`,

    broadcastRoutingKeys: [
    "player.kick",
    "system.announcement",
  ],

    unicastPattern: `*.#.${instanceId}`, 


  // 🌐 Server
  port: Number(process.env.PORT) || 4000,
  wsPath: required("WS_PATH"),

  // 🔐 Security
  jwtSecret: required("JWT_SECRET"),
  jwtExpiry: (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],

  // 🗄 Infrastructure
  redisUrl: required("REDIS_URL"),
  rabbitmqUrl: required("RABBITMQ_URL"),
};
