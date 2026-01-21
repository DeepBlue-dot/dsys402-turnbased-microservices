import { redis } from "../config/redis.js";

const RANKED_QUEUE_KEY = "match:queue:ranked";
const JOIN_TIMES_KEY = "match:join_times";

type PlayerDisconnectedEvent = {
  type: "PLAYER_DISCONNECTED";
  payload: {
    userId: string;
  };
};

type MatchmakingEvent = PlayerDisconnectedEvent;


export const handleIncomingEvents = async (event: MatchmakingEvent) => {
  if (event.type !== "PLAYER_DISCONNECTED") return;

  const { userId } = event.payload;

  if (!userId) {
    console.warn("[Matchmaking] PLAYER_DISCONNECTED missing userId");
    return;
  }

  console.log(
    `[Matchmaking] Janitor: cleaning up disconnected player ${userId}`
  );

  try {
    const pipeline = redis.pipeline();

    pipeline.zrem(RANKED_QUEUE_KEY, userId);
    pipeline.hdel(JOIN_TIMES_KEY, userId);

    await pipeline.exec();
  } catch (err) {
    console.error(
      `[Matchmaking] Failed to clean up player ${userId}`,
      err
    );
  }
};
