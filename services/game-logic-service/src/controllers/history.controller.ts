import { Response } from "express";
import { AuthRequest } from "../types/types.js";
import { MatchHistory } from "../models/MatchHistory.model.js";

export const getGameHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1. Fetch matches where the userId is in the players array
    // Sorted by most recent first
    const matches = await MatchHistory.find({ players: userId })
      .sort({ endedAt: -1 })
      .limit(50); // Limit to last 50 games for performance

    // 2. Format response
    const history = matches.map(m => ({
      matchId: m.matchId,
      opponentId: m.players.find(id => id !== userId),
      result: m.winnerId === userId ? "WIN" : m.winnerId === null ? "DRAW" : "LOSS",
      finalBoard: m.finalBoard,
      reason: m.reason,
      date: m.endedAt
    }));

    res.json(history);
  } catch (err: any) {
    console.error("[HistoryController] Error:", err);
    res.status(500).json({ error: "Failed to fetch game history" });
  }
};