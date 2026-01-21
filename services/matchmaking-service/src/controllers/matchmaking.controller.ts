import { Response } from "express";
import { AuthRequest } from "../types/types.js";
import * as matchmakingService from "../services/matchmaking.service.js";

/**
 * POST /api/matchmaking/join
 * Protected by authMiddleware
 */
export const join = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await matchmakingService.joinMatchmaking(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/matchmaking/leave
 * Protected by authMiddleware
 */
export const leave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await matchmakingService.leaveQueue(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};