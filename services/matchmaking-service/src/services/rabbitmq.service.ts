import amqp from "amqplib";
import { config } from "../config/env.js";

let channel: amqp.Channel | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const assertChannel = (): amqp.Channel => {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  return channel;
};

export const initRabbit = async () => {
  while (!channel) {
    try {
      console.log("[Matchmaking] Connecting to RabbitMQ...");

      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      await channel.assertExchange(config.eventsExchange, "topic", {
        durable: true,
      });

      await channel.assertQueue(config.matchmakingQueue, {
        durable: true,
      });

      for (const key of config.matchmakingRoutingKeys) {
        await channel.bindQueue(
          config.matchmakingQueue,
          config.eventsExchange,
          key,
        );
      }

      console.log("[Matchmaking] RabbitMQ connected");
    } catch (err) {
      console.error("[Matchmaking] RabbitMQ not ready, retrying...");
      await wait(5000);
    }
  }
};

export const consumeEvents = async (handler: (event: any) => Promise<void>) => {
  const ch = assertChannel();

  console.log(`[Matchmaking] Listening on ${config.matchmakingQueue}`);

  await ch.consume(config.matchmakingQueue, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      ch.ack(msg);
    } catch (err) {
      console.error("[Matchmaking] Event handling failed", err);
      ch.nack(msg, false, false);
    }
  });
};

export const publishEvent = async (routingKey: string, payload: any) => {
  const ch = assertChannel();

  const event = {
    type: routingKey,
    data: payload,
    occurredAt: new Date().toISOString(),
  };

  ch.publish(
    config.eventsExchange,
    "match.created",
    Buffer.from(JSON.stringify(event)),
    { persistent: true },
  );

  console.log(`[EVENT] ${routingKey}`, payload);
};
