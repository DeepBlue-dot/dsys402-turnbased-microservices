// services/player.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

// Define types for better TypeScript support
interface RegisterData {
  username: string;
  email: string;
  password: string;
}

interface LoginData {
  email?: string;
  password?: string;
}

interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

interface VerifyResult {
  valid: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
    wins: number;
    losses: number;
    rating: number;
  };
  error?: string;
}

export const playerService = {
  async register({ username, email, password }: RegisterData) {
    const existing = await prisma.player.findFirst({
      where: { OR: [{ username }, { email }] },
    });

    if (existing) {
      throw new Error("Username or email already exists");
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.player.create({
      data: {
        username,
        email,
        password: hashed,
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        wins: true,
        losses: true,
        rating: true,
        createdAt: true,
      }
    });

    return user;
  },

  async login({ email, password }: LoginData) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const user = await prisma.player.findUnique({
      where: { email },
    });

    if (!user) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Invalid credentials");

    // Update player status to ONLINE
    await prisma.player.update({
      where: { id: user.id },
      data: { status: "ONLINE" }
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    // Create session
    await prisma.session.create({
      data: {
        token,
        playerId: user.id,
      },
    });

    return token;
  },

  async logout(token: string) {
    try {
      // Decode token to get user ID without verification (in case token is expired)
      const decoded = jwt.decode(token) as JwtPayload;
      
      if (decoded?.userId) {
        // Update player status to OFFLINE
        await prisma.player.update({
          where: { id: decoded.userId },
          data: { status: "OFFLINE" }
        });
      }

      // Delete the session
      await prisma.session.delete({ where: { token } });
      
      return { message: "Logged out successfully" };
    } catch {
      // If token is invalid or session doesn't exist, still return success
      return { message: "Logged out successfully" };
    }
  },

  async verifyToken(token: string): Promise<VerifyResult> {
    try {
      // 1. Check if session exists in database
      const session = await prisma.session.findUnique({
        where: { token }
      });

      if (!session) {
        return { valid: false, error: "Session not found" };
      }

      // 2. Verify JWT token
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "secret"
      ) as JwtPayload;

      // 3. Fetch user details
      const user = await prisma.player.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
          wins: true,
          losses: true,
          rating: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!user) {
        return { valid: false, error: "User not found" };
      }

      return {
        valid: true,
        user
      };
    } catch (error: any) {
      // Handle different JWT errors
      if (error.name === "TokenExpiredError") {
        // Auto-delete expired token sessions
        await prisma.session.deleteMany({
          where: { token }
        }).catch(() => {});
        
        return { 
          valid: false, 
          error: "Token expired. Please login again." 
        };
      }
      
      if (error.name === "JsonWebTokenError") {
        return { 
          valid: false, 
          error: "Invalid token" 
        };
      }
      
      return { 
        valid: false, 
        error: "Authentication failed" 
      };
    }
  },

  async refreshToken(oldToken: string) {
    try {
      // Verify old token
      const result = await this.verifyToken(oldToken);
      
      if (!result.valid || !result.user) {
        throw new Error("Cannot refresh invalid token");
      }

      // Delete old session
      await prisma.session.delete({ where: { token: oldToken } });

      // Create new token
      const newToken = jwt.sign(
        { userId: result.user.id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1d" }
      );

      // Create new session
      await prisma.session.create({
        data: {
          token: newToken,
          playerId: result.user.id,
        },
      });

      return newToken;
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
};