import server, { startApp } from "./app.js";
import { config } from "./config/env.js";

startApp().catch(console.error);

server.listen(config.port, () => {
  console.log(
    `[EventService] HTTP + WS running on ${config.port}`
  );
});
