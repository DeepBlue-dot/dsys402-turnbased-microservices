import { Response } from "express";
import { AuthRequest } from "../types/types.js";
import { MatchHistory } from "../models/MatchHistory.model.js";


export const getGameHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ─────────────────────────────
    // Pagination
    // ─────────────────────────────
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // ─────────────────────────────
    // Sorting (safe allowlist)
    // ─────────────────────────────
    const sortBy = String(req.query.sortBy || "endedAt");
    const order = req.query.order === "asc" ? 1 : -1;

    const SORT_FIELDS = ["endedAt", "durationMs", "turnCount"] as const;

    const sortField = SORT_FIELDS.includes(sortBy as any)
      ? sortBy
      : "endedAt";

    const sort: Record<string, 1 | -1> = {
      [sortField]: order,
    };

    // ─────────────────────────────
    // Filters
    // ─────────────────────────────
    const {
      result,   // WIN | LOSS | DRAW
      reason,   // COMPLETED | FORFEIT | TIMEOUT
      search,   // opponentId or matchId
      from,     // ISO date
      to,
    } = req.query;

    const query: any = { players: userId };

    // Date range
    if (from || to) {
      query.endedAt = {};
      if (from) query.endedAt.$gte = new Date(from as string);
      if (to) query.endedAt.$lte = new Date(to as string);
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    // Result filter
    if (result === "WIN") query.winnerId = userId;
    if (result === "LOSS") query.winnerId = { $ne: userId };
    if (result === "DRAW") query.winnerId = null;

    // Search
    if (search) {
      query.$or = [
        { matchId: { $regex: search, $options: "i" } },
        { players: search },
      ];
    }

    // ─────────────────────────────
    // Fetch
    // ─────────────────────────────
    const [matches, total] = await Promise.all([
      MatchHistory.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select(
          "matchId players winnerId symbols finalBoard reason endedAt durationMs turnCount"
        )
        .lean(),

      MatchHistory.countDocuments(query),
    ]);

    // ─────────────────────────────
    // Format
    // ─────────────────────────────
    const data = matches.map(match => {
      const opponentId = match.players.find(p => p !== userId) ?? null;

      const computedResult =
        match.winnerId === userId
          ? "WIN"
          : match.winnerId === null
          ? "DRAW"
          : "LOSS";

      return {
        matchId: match.matchId,
        opponentId,
        result: computedResult,
        yourSymbol: match.symbols?.[userId] ?? null,
        finalBoard: match.finalBoard,
        reason: match.reason,
        turnCount: match.turnCount,
        durationMs: match.durationMs,
        endedAt: match.endedAt,
      };
    });

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sortBy: sortField,
      order: order === 1 ? "asc" : "desc",
      data,
    });
  } catch (err) {
    console.error("[HistoryController] Error:", err);
    res.status(500).json({ error: "Failed to fetch game history" });
  }
};


export const getMatchById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { matchId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!matchId) {
      res.status(400).json({ error: "Match ID is required" });
      return;
    }

    const match = await MatchHistory.findOne({ matchId }).lean();

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    // 🔐 Security check: user must be one of the players
    if (!match.players.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const opponentId = match.players.find(p => p !== userId) ?? null;

    const result =
      match.winnerId === userId
        ? "WIN"
        : match.winnerId === null
        ? "DRAW"
        : "LOSS";

    res.json({
      matchId: match.matchId,

      players: {
        you: userId,
        opponent: opponentId,
      },

      symbols: {
        you: match.symbols[userId],
        opponent: opponentId ? match.symbols[opponentId] : null,
      },

      firstTurn: match.firstTurn,

      result,
      winnerId: match.winnerId,

      reason: match.reason,
      terminationBy: match.terminationBy,

      finalBoard: match.finalBoard,

      moves: match.moves.map(m => ({
        playerId: m.playerId,
        position: m.position,
        symbol: m.symbol,
        at: m.at,
      })),

      turnCount: match.turnCount,

      startedAt: match.startedAt,
      endedAt: match.endedAt,
      durationMs: match.durationMs,
    });
  } catch (err) {
    console.error("[MatchController] Error:", err);
    res.status(500).json({ error: "Failed to fetch match" });
  }
};
