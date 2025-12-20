import { Request, Response } from "express";
import { verifyToken, canJoin } from "../services/player.service.js";
import { joinMatchmaking, leaveQueue } from "../services/matchmaking.service.js";

export const join = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1️⃣ Verify token
    const auth = await verifyToken(token);
    if (!auth.valid) {
      res.status(401).json(auth);
      return;
    }

    const playerId = auth.user.id;

    // 2️⃣ Eligibility check
    const eligibility = await canJoin(playerId);
    if (!eligibility.allowed) {
      res.status(400).json(eligibility);
      return;
    }

    // 3️⃣ Join matchmaking
    const result = await joinMatchmaking(
      playerId,
      eligibility.player.rating
    );

    res.json(result);
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Matchmaking failed" });
  }
};

export const leave = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1️⃣ Verify token
    const auth = await verifyToken(token);
    if (!auth.valid) {
      res.status(401).json(auth);
      return;
    }

    const playerId = auth.user.id;

    // 2️⃣ Leave matchmaking (idempotent)
    await leaveQueue(playerId);

    res.json({
      success: true,
      message: "Left matchmaking",
    });
  } catch (err) {
    console.error("[Matchmaking] leave failed", err);
    res.status(500).json({ error: "Failed to leave matchmaking" });
  }
};