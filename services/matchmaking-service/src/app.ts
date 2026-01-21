import express from "express";
import matchmakingRoutes from "./routes/matchmaking.routes.js";
import { config } from "./config/env.js";
import { initRabbit, consumeEvents } from "./services/rabbitmq.service.js";
import { startMatchmakingWorker } from "./worker/matchmaker.js";

const app = express();
app.use(express.json());
app.use("/", matchmakingRoutes);

const startApp = async () => {
  await initRabbit();
  await consumeEvents();
  await startMatchmakingWorker(); 


  app.listen(config.port, () => {
    console.log(`[Matchmaking] Running on ${config.port}`);
  });

  console.log("[MatchmakingService] Event consumers started");
};

export default startApp;

