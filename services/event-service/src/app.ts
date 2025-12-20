import express from "express";
import http from "http";
import { startWSServer } from "./ws/ws.server.js";
import { initRabbit } from "./services/rabbitmq.service.js";
import { startGameEventConsumer } from "./consumers/gameEvents.consumer.js";

const app = express();
const server = http.createServer(app);

export const startApp = async () => {
  await initRabbit();
  await startGameEventConsumer();
  startWSServer(server);
};

export default server;
