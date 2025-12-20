import { initRabbit } from "./services/rabbitmq.service.js";
import { connectMongo } from "./db/mongo.js";
import { startMatchCreatedConsumer } from "./consumers/matchCreated.consumer.js";
import { startPlayerMoveConsumer } from "./consumers/playerMove.consumer.js";
import { startPauseTimeoutWatcher } from "./engine/pause-timeout.js";
import { startPlayerEventsConsumer } from "./consumers/player-events.consumer.js";
import { startGameControlConsumer } from "./consumers/game-control.consumer.js";

export const start = async () => {
  await connectMongo();
  await initRabbit();

  await startPauseTimeoutWatcher();
  await startPlayerEventsConsumer();
  await startMatchCreatedConsumer();
  await startPlayerMoveConsumer();
  await startGameControlConsumer();

  console.log("[GameLogic] Service started");
};

