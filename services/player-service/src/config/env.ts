import dotenv from "dotenv";
dotenv.config();

const requiredEnv = ["JWT_SECRET", "DATABASE_URL"];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const config = {
  // Server
  port: process.env.PORT || 3000,

  // PostgreSQL
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  // RabbitMQ
  rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
  
  // Queues
  playerEventsQueue: "player_events",

  // Auth
  jwtSecret: process.env.JWT_SECRET!,
};