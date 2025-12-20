import dotenv from "dotenv";
dotenv.config();

const required = (k: string) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k]!;
};

export const config = {
  port: Number(process.env.PORT) || 3001,

  redisUrl: required("REDIS_URL"),
  rabbitmqUrl: required("RABBITMQ_URL"),

  matchmakingQueue: "matchmaking:queue",
  matchmakingLockPrefix: "matchmaking:player:",
  
  playerEventsQueue: "player_events", 

  playerServiceUrl: required("PLAYER_SERVICE_URL"),
  matchCreatedQueue: "match_created",
};
