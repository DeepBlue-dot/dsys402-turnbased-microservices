import express from "express";
import historyRoutes from "./routes/MatchHistory.routes.js";
import { config } from "./config/env.js";
import { initRabbit, consumeEvents } from "./services/rabbitmq.service.js";
import { handleEvents } from "./consumers/Event.consumer.js";
import { startWatchdog } from "./worker/watchdog.worker.js";
import { connectMongo } from "./config/mongo.js";

const app = express();
app.use(express.json());
app.use("/", historyRoutes);

const startApp = async () => {
  await initRabbit();
  await consumeEvents(config.gameLogicQueue, handleEvents);
  await startWatchdog();

  await connectMongo();

  app.listen(config.port, () => {
    console.log(`[Matchmaking] Running on ${config.port}`);
  });

  console.log("[MatchmakingService] Event consumers started");
};

export default startApp;
