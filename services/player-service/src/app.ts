import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { initRabbit, consumePlayerEvents } from "./services/rabbitmq.service.js";
import { handlePlayerEvent } from "./consumers/playerEvents.consumer.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", router);

export const startApp = async () => {
  await initRabbit();
  await consumePlayerEvents(handlePlayerEvent);

  console.log("[PlayerService] Event consumers started");
};

export default app;
