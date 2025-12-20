import app, { startApp } from "./app.js";
import { config } from "./config/env.js";

startApp().catch(console.error);

app.listen(config.port, () => {
  console.log(
    `[PlayerService] HTTP running on port ${config.port}`
  );
});
