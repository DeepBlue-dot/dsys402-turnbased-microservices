import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { initRabbit, consumeEvents } from "./services/rabbitmq.service.js";
import { handleEvents } from "./consumers/Events.consumer.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", router);

export const startApp = async () => {
  await initRabbit();
  await consumeEvents(handleEvents);

  console.log("[PlayerService] Event consumers started");
};

export default app;
