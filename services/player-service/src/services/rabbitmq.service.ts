import amqp from "amqplib";
import { config } from "../config/env.js";

let channel: amqp.Channel | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const assertChannel = (): amqp.Channel => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }
  return channel;
};

export const initRabbit = async () => {
  while (!channel) {
    try {
      console.log("[PlayerService] Connecting to RabbitMQ...");

      const conn = await amqp.connect(config.rabbitmqUrl);
      channel = await conn.createChannel();

      await channel.assertQueue(config.playerEventsQueue, {
        durable: true,
      });

      console.log("[PlayerService] RabbitMQ connected");
    } catch (err) {
      console.error("[PlayerService] RabbitMQ not ready, retrying...");
      await wait(5000);
    }
  }
};

export const consumeEvents = async (
  handler: (event: any) => Promise<void>
) => {
  const ch = assertChannel();

  console.log(`[PlayerService] Listening on ${config.playerEventsQueue}`);

  await ch.consume(config.playerEventsQueue, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      ch.ack(msg);
    } catch (err) {
      console.error("[PlayerService] Event handler failed:", err);
      ch.nack(msg, false, false);
    }
  });
};
