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
      console.log("[EventService] Connecting to RabbitMQ...");

      const conn = await amqp.connect(config.rabbitmqUrl);
      channel = await conn.createChannel();

      await channel.assertQueue(config.playerEventsQueue, { durable: true });
      await channel.assertQueue(config.gameEventsQueue, { durable: true });
      await channel.assertQueue(config.playerMoveQueue, { durable: true });

      console.log("[EventService] RabbitMQ connected");
    } catch {
      console.error("[EventService] RabbitMQ not ready, retrying...");
      await wait(5000);
    }
  }
};

export const publish = async (queue: string, event: any) => {
  const ch = assertChannel();

  ch.sendToQueue(queue, Buffer.from(JSON.stringify(event)), {
    persistent: true,
  });
  console.log(`[GAME EVENT] ${queue} :`, event);

};

export const consume = async (
  queue: string,
  handler: (data: any) => Promise<void>
) => {
  const ch = assertChannel();

  await ch.consume(queue, async (msg) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    console.log(`[GAME EVENT] ${queue} :`, data);

    await handler(data);

    ch.ack(msg);
  });
};
