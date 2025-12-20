import dotenv from "dotenv";
dotenv.config();

// Simple validation
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const config = {
  port: process.env.PORT || 3000,
  
  rabbitmqUrl:
    process.env.RABBITMQ_URL ||
    "amqp://guest:guest@rabbitmq:5672",
  
  playerEventsQueue: "player_events",
  
  jwtSecret: process.env.JWT_SECRET!,
  databaseUrl: process.env.DATABASE_URL!,
};