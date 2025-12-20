import app from "./app.js";
import { initRabbit } from "./services/rabbitmq.service.js";
import { config } from "./config/env.js";
import { startPlayerEventsConsumer } from "./consumers/joinMatchmaking.consumer.js";

await initRabbit();
await startPlayerEventsConsumer();

app.listen(config.port, () => {
  console.log(`[Matchmaking] Running on ${config.port}`);
});
