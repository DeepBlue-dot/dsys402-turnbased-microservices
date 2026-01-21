import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(200).optional(),
});

export const updateEmailSchema = z.object({
  email: z.string().email(),
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});