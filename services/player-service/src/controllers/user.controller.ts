// services/player-service/src/controllers/user.controller.ts
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// GET /users
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const search = (req.query.search as string) || "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.player.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        rating: true,
        wins: true,
        losses: true,
        createdAt: true,
      },
    }),

    prisma.player.count({ where }),
  ]);

  res.json({
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
};

// GET /users/:id
export const getUserById = async (req: Request, res: Response) => {
  const id = req.params.id;

  const user = await prisma.player.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      rating: true,
      wins: true,
      losses: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const requesterId = (req as any).userId;

  if (id !== requesterId) {
    res.status(403).json({ error: "Forbidden: You can only update your own profile" });
    return;
  }

  const { username, email } = req.body;

  try {
    const existing = await prisma.player.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (username) {
      const taken = await prisma.player.findFirst({
        where: { username, NOT: { id } },
      });
      if (taken) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
    }

    if (email) {
      const taken = await prisma.player.findFirst({
        where: { email, NOT: { id } },
      });
      if (taken) {
        res.status(400).json({ error: "Email already registered" });
        return;
      }
    }

    const updated = await prisma.player.update({
      where: { id },
      data: { username, email },
      select: {
        id: true,
        username: true,
        email: true,
        rating: true,
        wins: true,
        losses: true,
      },
    });

    res.json(updated);
    return;
  } catch (error) {
    res.status(400).json({ error: "Update failed" });
    return;
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const requesterId = (req as any).userId;

  if (id !== requesterId) {
    res.status(403).json({ error: "Forbidden: You can only delete your own account" });
    return;
  }

  try {
    await prisma.player.delete({ where: { id } });
    res.json({ message: "User deleted successfully" });
    return;
  } catch {
    res.status(404).json({ error: "User not found or already deleted" });
    return;
  }
};

export const getTheUser = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const user = await prisma.player.findUnique({ where: { id: userId } });
  res.json(user);
}

export const canJoinMatchmaking = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { playerId } = req.query;

  if (!playerId || typeof playerId !== "string") {
    res.status(400).json({
      allowed: false,
      error: "playerId is required",
    });
    return;
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      status: true,
      rating: true,
    },
  });

  if (!player) {
    res.status(404).json({
      allowed: false,
      error: "Player not found",
    });
    return;
  }

  if (player.status !== "ONLINE") {
    res.json({
      allowed: false,
      reason: player.status,
    });
    return;
  }

  res.json({
    allowed: true,
    player: {
      id: player.id,
      rating: player.rating,
      status: player.status,
    },
  });
};
