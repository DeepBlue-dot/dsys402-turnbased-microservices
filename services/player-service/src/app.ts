import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { initRabbit, consumeEvents } from "./services/rabbitmq.service.js";
import { handleEvents } from "./consumers/Events.consumer.js";
import { config } from "./config/env.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", router);

const startApp = async () => {
  await initRabbit();
  await consumeEvents(config.playerEventsQueue, handleEvents);

  app.listen(config.port, () => {
    console.log(`[PlayerService] HTTP running on port ${config.port}`);
  });

  console.log("[PlayerService] Event consumers started");
};

export default startApp;
