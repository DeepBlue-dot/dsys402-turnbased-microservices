import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { config } from "../config/env.js";
import {
  registerSchema,
  loginSchema,
} from "../validators/player.validator.js";

export const playerService = {
  async register(input: unknown) {
    const { username, email, password } = registerSchema.parse(input);

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.player.findUnique({ where: { email } }),
      prisma.playerProfile.findUnique({ where: { username } }),
    ]);

    if (existingEmail) throw new Error("Email already registered");
    if (existingUsername) throw new Error("Username already taken");

    const hashedPassword = await bcrypt.hash(
      password,
      config.bcryptRounds
    );

    const player = await prisma.player.create({
      data: {
        email,
        password: hashedPassword,
        profile: { create: { username } },
        stats: { create: {} },
      },
      select: {
        id: true,
        email: true,
        profile: { select: { username: true } },
        stats: { select: { rating: true } },
      },
    });

    return player;
  },

  async login(input: unknown) {
    const { email, password } = loginSchema.parse(input);

    const user = await prisma.player.findUnique({
      where: { email },
      select: { id: true, password: true },
    });

    if (!user) throw new Error("Invalid credentials");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid credentials");

    return jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );
  },

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(
        token,
        config.jwtSecret
      ) as { userId: string };

      const user = await prisma.player.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          profile: { select: { username: true } },
          stats: { select: { rating: true } },
        },
      });

      if (!user) {
        return { valid: false, error: "User no longer exists" };
      }

      return { valid: true, user };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return { valid: false, error: "Token expired" };
      }
      return { valid: false, error: "Invalid token" };
    }
  },

  async refreshToken(token: string) {
    const result = await this.verifyToken(token);

    if (!result.valid || !result.user) {
      throw new Error("Invalid or expired token");
    }

    return jwt.sign(
      { userId: result.user.id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );
  },

  async logout() {
    return {
      message: "Logged out. Client must delete token.",
    };
  },
};
