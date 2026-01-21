import app from "./app.js";
import { initRabbit } from "./services/rabbitmq.service.js";
import { config } from "./config/env.js";

await initRabbit();

app.listen(config.port, () => {
  console.log(`[Matchmaking] Running on ${config.port}`);
});

