import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../types/types.js";
import * as schema from "../validators/player.validator.js";

/**
 * Higher-order function to catch async errors and pass them to global error handler
 */
const catchAsync = (fn: Function) => (req: AuthRequest, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Utility: Standardized Player Formatter
 */
const formatPlayer = (player: any) => ({
  id: player.id,
  email: player.email,
  username: player.profile?.username,
  avatarUrl: player.profile?.avatarUrl,
  bio: player.profile?.bio,
  stats: player.stats ? {
    rating: player.stats.rating,
    wins: player.stats.wins,
    losses: player.stats.losses,
    draws: player.stats.draws,
  } : null,
  createdAt: player.createdAt,
});

// GET /me
export const getMyData = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = await prisma.player.findUnique({
    where: { id: req.userId },
    include: { profile: true, stats: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(formatPlayer(user));
});

// PUT /me/profile
export const updateMyProfile = catchAsync(async (req: AuthRequest, res: Response) => {
  const validated = schema.updateProfileSchema.parse(req.body);

  if (validated.username) {
    const taken = await prisma.playerProfile.findFirst({
      where: { username: validated.username, NOT: { playerId: req.userId } },
    });
    if (taken) return res.status(400).json({ error: "Username already taken" });
  }

  const updated = await prisma.playerProfile.update({
    where: { playerId: req.userId },
    data: validated,
  });

  res.json(updated);
});

// PUT /me/email
export const updateMyEmail = catchAsync(async (req: AuthRequest, res: Response) => {
  const { email } = schema.updateEmailSchema.parse(req.body);

  const taken = await prisma.player.findFirst({
    where: { email, NOT: { id: req.userId } },
  });
  if (taken) return res.status(400).json({ error: "Email already in use" });

  await prisma.player.update({
    where: { id: req.userId },
    data: { email },
  });

  res.json({ message: "Email updated successfully" });
});

// PUT /me/password
export const updateMyPassword = catchAsync(async (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = schema.updatePasswordSchema.parse(req.body);

  const user = await prisma.player.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) return res.status(401).json({ error: "Incorrect current password" });

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.player.update({
      where: { id: req.userId },
      data: { password: hashed },
    }),
  ]);

  res.json({ message: "Password updated and all sessions cleared. Please log in again." });
});

// DELETE /me
export const deleteMyAccount = catchAsync(async (req: AuthRequest, res: Response) => {
  await prisma.player.delete({ where: { id: req.userId } });
  res.json({ message: "Account successfully deleted" });
});

// GET /:id/profile
export const getPublicProfile = catchAsync(async (req: AuthRequest, res: Response) => {
  const profile = await prisma.playerProfile.findUnique({
    where: { playerId: req.params.id },
    select: { username: true, avatarUrl: true, bio: true } // Don't even fetch playerId/id
  });

  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json(profile);
});

// GET /:id/stats
export const getPublicStats = catchAsync(async (req: AuthRequest, res: Response) => {
  const stats = await prisma.playerStats.findUnique({
    where: { playerId: req.params.id },
    select: { rating: true, wins: true, losses: true, draws: true }
  });

  if (!stats) return res.status(404).json({ error: "Statistics not found" });
  res.json(stats);
});

// GET / (Paginated Search)
export const searchPlayers = catchAsync(async (req: AuthRequest, res: Response) => {
  const search = String(req.query.search || "");
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
  const skip = (page - 1) * limit;

  const whereClause = {
    profile: {
      username: { contains: search, mode: "insensitive" as const },
    },
  };

  const [players, total] = await Promise.all([
    prisma.player.findMany({
      where: whereClause,
      take: limit,
      skip,
      include: { profile: true, stats: true },
      orderBy: { stats: { rating: "desc" } },
    }),
    prisma.player.count({ where: whereClause }),
  ]);

  res.json({
    data: players.map(formatPlayer),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});