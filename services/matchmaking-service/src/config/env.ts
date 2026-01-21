import dotenv from "dotenv";
dotenv.config();

const required = (k: string) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k]!;
};

export const config = {
  matchmakingQueue: "matchmaking:queue",

  port: Number(process.env.PORT) || 3000,

  redisUrl: process.env.REDIS_URL || required("REDIS_URL"),

  rabbitmqUrl: process.env.RABBITMQ_URL || required("RABBITMQ_URL"),

  jwtSecret: process.env.JWT_SECRET || required("JWT_SECRET"),
};
