import amqp from "amqplib";
import { config } from "../config/env.js";
import { Event } from "../types/types.js";

let channel: amqp.Channel | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const assertChannel = (): amqp.Channel => {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  return channel;
};

export const initRabbit = async () => {
  while (!channel) {
    try {
      console.log(
        `[GATEWAY:${config.instanceId}] Connecting to RabbitMQ...`
      );

      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      // Topic exchange for Broadcast + Unicast routing
      await channel.assertExchange(config.eventsExchange, "topic", {
        durable: true,
      });

      // Instance-owned queue (State-Affinity)
      await channel.assertQueue(config.gatewayQueue, {
        exclusive: true, // 🔑 stronger than autoDelete
      });

      for (const key of config.broadcastRoutingKeys) {
        await channel.bindQueue(
          config.gatewayQueue,
          config.eventsExchange,
          key
        );
      }

     await channel.bindQueue(
        config.gatewayQueue,
        config.eventsExchange,
        config.unicastPattern
      );

      console.log(
        `[GATEWAY:${config.instanceId}] RabbitMQ connected`
      );
    } catch (err) {
      console.error(
        `[GATEWAY:${config.instanceId}] RabbitMQ not ready, retrying...`
      );
      await wait(5000);
    }
  }
};

export const consumeEvents = async (
  queue: string,
  handler: (event: Event) => Promise<void>
) => {
  const ch = assertChannel();

  await ch.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      ch.ack(msg);
    } catch (err) {
      console.error("[GATEWAY] Event handling failed", err);
      ch.nack(msg, false, false); // drop poison messages
    }
  });
};

export const publishEvent = async (
  routingKey: string,
  payload: any
) => {
  const ch = assertChannel();

  const event: Event = {
    type: routingKey,
    data: payload,
    occurredAt: new Date().toISOString(),
  };

  ch.publish(
    config.eventsExchange,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );

  console.log(`[EVENT] ${routingKey}`, payload);
};
