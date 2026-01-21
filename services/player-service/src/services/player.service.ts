import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { LoginData, RegisterData, VerifyResult } from "../types/types.js";

const JWT_SECRET = process.env.JWT_SECRET || "secret";
const TOKEN_EXPIRY = "1d";
const BCRYPT_ROUNDS = 10;

export const playerService = {
  async register({ username, email, password }: RegisterData) {
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.player.findUnique({ where: { email } }),
      prisma.playerProfile.findUnique({ where: { username } }),
    ]);

    if (existingEmail) throw new Error("Email already registered");
    if (existingUsername) throw new Error("Username already taken");

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    return prisma.player.create({
      data: {
        email,
        password: hashedPassword,
        profile: { create: { username } },
        stats: { create: {} },
      },
      include: {
        profile: { select: { username: true } },
        stats: { select: { rating: true } },
      },
    });
  },

  async login({ email, password }: LoginData) {
    if (!email || !password) throw new Error("Email and password required");

    const user = await prisma.player.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid credentials");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid credentials");

    return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  },

  async logout() {
    return { message: "Logged out successfully. Please delete your local token." };
  },

  async verifyToken(token: string): Promise<VerifyResult> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

      const user = await prisma.player.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          profile: { select: { username: true } },
          stats: { select: { rating: true } },
        },
      });

      if (!user) return { valid: false, error: "User no longer exists" };

      return { valid: true, user };
    } catch (error: unknown) {
      const errorMsg =
        error instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token";
      return { valid: false, error: errorMsg };
    }
  },

  async refreshToken(token: string) {
    const result = await this.verifyToken(token);
    if (!result.valid || !result.user) throw new Error("Cannot refresh: Token is invalid or expired");
    return jwt.sign({ userId: result.user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  },
};
