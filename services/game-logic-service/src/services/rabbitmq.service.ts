import amqp from "amqplib";
import { config } from "../config/env.js";

let channel: amqp.Channel | null = null;

/* -------------------- helpers -------------------- */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const assertChannel = (): amqp.Channel => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }
  return channel;
};

/* -------------------- init -------------------- */

export const initRabbit = async () => {
  while (!channel) {
    try {
      console.log("[GameLogic] Connecting to RabbitMQ...");

      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      await channel.assertQueue(config.matchCreatedQueue, { durable: true });
      await channel.assertQueue(config.playerMoveQueue, { durable: true });
      await channel.assertQueue(config.playerEventsQueue, { durable: true });
      await channel.assertQueue(config.gameEventsQueue, { durable: true });

      console.log("[GameLogic] RabbitMQ connected");
    } catch (err) {
      console.error("[GameLogic] RabbitMQ not ready, retrying...");
      await wait(5000);
    }
  }
};

/* -------------------- publish -------------------- */

export const publish = async (queue: string, event: any) => {
  const ch = assertChannel();

  ch.sendToQueue(queue, Buffer.from(JSON.stringify(event)), {
    persistent: true,
  });

  console.log(`[GAME EVENT] ${queue} :`, event);
};

/* -------------------- consume -------------------- */

export const consume = async (
  queue: string,
  handler: (data: any) => Promise<void>
) => {
  const ch = assertChannel();

  console.log(`[GameLogic] Waiting for messages on ${queue}`);

  await ch.consume(queue, async (msg) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    console.log(`[GAME EVENT] ${queue} :`, data);

    try {
      await handler(data);
      ch.ack(msg);
    } catch (err) {
      console.error("[GameLogic] Handler error:", err);
      // discard bad message (no requeue)
      ch.nack(msg, false, false);
    }
  });
};
