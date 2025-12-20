import { prisma } from "../config/prisma.js";

export const handlePlayerEvent = async (event: any) => {
  switch (event.event) {
    /**
     * Fired when a match starts
     */
    case "player_in_game": {
      const { playerIds } = event;

      await prisma.player.updateMany({
        where: { id: { in: playerIds } },
        data: { status: "IN_GAME" },
      });

      console.log("[PlayerService] Players set IN_GAME:", playerIds);
      break;
    }

    /**
     * Fired when a game finishes normally
     */
    case "game_finished": {
      const { winnerId, loserId, reason, } = event;

      const ops = [];

      // Winner always goes ONLINE
      ops.push(
        prisma.player.update({
          where: { id: winnerId },
          data: {
            wins: { increment: 1 },
            rating: { increment: 20 },
            status: "ONLINE",
          },
        })
      );

      if (reason === "disconnect") {
        // Loser disconnected → OFFLINE
        ops.push(
          prisma.player.update({
            where: { id: loserId },
            data: {
              losses: { increment: 1 },
              rating: { decrement: 20 },
              status: "OFFLINE",
            },
          })
        );
      } else {
        // Normal finish
        ops.push(
          prisma.player.update({
            where: { id: loserId },
            data: {
              losses: { increment: 1 },
              rating: { decrement: 20 },
              status: "ONLINE",
            },
          })
        );
      }

      await prisma.$transaction(ops);

      console.log("[PlayerService] Game finished:", {
        winnerId,
        loserId,
        reason,
      });

      break;
    }

    /**
     * Fired on WS reconnect
     */
    case "player_reconnected": {
      const { playerId } = event;

      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) return;

      if (player.status !== "IN_GAME") {
        await prisma.player.update({
          where: { id: playerId },
          data: { status: "ONLINE" },
        });

        console.log("[PlayerService] Player reconnected:", playerId);
      }

      break;
    }

    case "player_connected": {
      const { playerId } = event;

      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) return;

      if (player.status !== "IN_GAME") {
        await prisma.player.update({
          where: { id: playerId },
          data: { status: "ONLINE" },
        });

        console.log("[PlayerService] Player reconnected:", playerId);
      }

      break;
    }

    default:
      console.log("[PlayerService] Ignored event:", event.event);
  }
};
