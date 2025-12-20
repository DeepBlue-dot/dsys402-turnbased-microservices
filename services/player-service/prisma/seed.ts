import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

/**
 * Configurable defaults
 */
const DEFAULT_RATING = 1200;
const SALT_ROUNDS = 12;

/**
 * Seed data
 */
const players = [
  {
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    role: "ADMIN",
    rating: 1500,
    wins: 10,
    losses: 2,
  },
  {
    username: "player1",
    email: "player1@example.com",
    password: "password123",
    role: "PLAYER",
    rating: DEFAULT_RATING,
    wins: 3,
    losses: 5,
  },
];

async function seedPlayers() {
  console.log("👤 Seeding players...");

  for (const player of players) {
    const passwordHash = await bcrypt.hash(
      player.password,
      SALT_ROUNDS
    );

    await prisma.player.upsert({
      where: { email: player.email },
      update: {
        username: player.username,
        role: player.role,
      },
      create: {
        username: player.username,
        email: player.email,
        password: passwordHash,
        role: player.role,
        rating: player.rating ?? DEFAULT_RATING,
        wins: player.wins ?? 0,
        losses: player.losses ?? 0,
        status: "ONLINE",
      },
    });

    console.log(`✅ Seeded player: ${player.email}`);
  }
}

async function main() {
  console.log("🌱 Starting database seed...");

  await prisma.$transaction(async () => {
    await seedPlayers();
  });

  console.log("🌱 Database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
