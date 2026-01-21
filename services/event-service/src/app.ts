import express from "express";
import http from "http";
import { startWSServer } from "./ws/ws.server.js";
import { consumeEvents, initRabbit } from "./services/rabbitmq.service.js";
import { handleEvents } from "./consumers/Events.consumer.js";
import { config } from "./config/env.js";
import router from "./routes/index.js";

const app = express();
app.use("/", router);
export const server = http.createServer(app);


const startApp = async () => {
  console.log(`[Gateway] Starting service...`);
  
  try {
    await initRabbit();
    await consumeEvents(config.gatewayQueue, handleEvents);
    
    console.log(`[Gateway] Starting WebSocket server...`);
    startWSServer(server);
    
    await server.listen(config.port, () => {
      console.log(`[Gateway] Service running on port ${config.port}`);
    });
    
    
  } catch (error) {
    console.error(`[Gateway] Failed to start service:`, error);
    process.exit(1);
  }
};


export default startApp;