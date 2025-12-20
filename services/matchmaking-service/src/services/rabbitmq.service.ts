import amqp from "amqplib";
import { config } from "../config/env.js";

let channel: amqp.Channel;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const initRabbit = async () => {
  while (true) {
    try {
      console.log("[Matchmaking] Connecting to RabbitMQ...");
      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      await channel.assertQueue(config.matchCreatedQueue, { durable: true });

      console.log("[Matchmaking] RabbitMQ connected");
      break;
    } catch (err) {
      console.error("[Matchmaking] RabbitMQ not ready, retrying...");
      await wait(5000);
    }
  }
};

export const consume = async (
  queue: string,
  handler: (event: any) => Promise<void>
) => {
  await channel.assertQueue(queue, { durable: true });

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      console.log(`[GAME EVENT] ${queue} :`, data);

      await handler(data);
      channel.ack(msg);
    } catch (err) {
      console.error("[Matchmaking] Event handling failed", err);
      channel.nack(msg, false, false); // dead-letter if needed
    }
  });
};

export const publishMatchCreated = async (data: any) => {
  channel.sendToQueue(
    config.matchCreatedQueue,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
  console.log(`[GAME EVENT] ${config.matchCreatedQueue} :`, data);
};
