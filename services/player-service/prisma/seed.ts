import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = new PrismaClient();

/**
 * Configurable defaults
 */
const DEFAULT_RATING = 1200;
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 12;

/**
 * Seed data
 * Note: `role` is not stored on the current Prisma `Player` model.
 * Role-related fields are therefore ignored by the schema-aware seeder.
 */
const players = [
  {
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    rating: 1500,
    wins: 10,
    losses: 2,
  },
  {
    username: "player1",
    email: "player1@example.com",
    password: "password123",
    rating: DEFAULT_RATING,
    wins: 3,
    losses: 5,
  },
];

/**
 * Upsert a single player and related profile/stats in a transaction.
 * Returns the Player id.
 */
async function upsertPlayer(tx: Prisma.TransactionClient, p: typeof players[number]) {
  // Hash the password before creating/updating
  const passwordHash = await bcrypt.hash(p.password, SALT_ROUNDS);

  // Find existing player by email
  const existing = await tx.player.findUnique({ where: { email: p.email } });

  let playerId: string;

  if (existing) {
    // Update stored password hash if necessary
    await tx.player.update({
      where: { email: p.email },
      data: { password: passwordHash },
    });
    playerId = existing.id;
  } else {
    const created = await tx.player.create({
      data: { email: p.email, password: passwordHash },
    });
    playerId = created.id;
  }

  // Upsert PlayerProfile (stores username)
  await tx.playerProfile.upsert({
    where: { playerId },
    update: { username: p.username },
    create: { playerId, username: p.username },
  });

  // Upsert PlayerStats
  await tx.playerStats.upsert({
    where: { playerId },
    update: {
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      rating: p.rating ?? DEFAULT_RATING,
    },
    create: {
      playerId,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      draws: 0,
      rating: p.rating ?? DEFAULT_RATING,
    },
  });

  return playerId;
}

async function seedAll(reset = false) {
  console.log("👤 Seeding players...");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const p of players) {
      if (reset) {
        // Remove existing player and related records by email
        const existing = await tx.player.findUnique({ where: { email: p.email } });
        if (existing) {
          await tx.playerStats.deleteMany({ where: { playerId: existing.id } });
          await tx.playerProfile.deleteMany({ where: { playerId: existing.id } });
          await tx.player.delete({ where: { id: existing.id } });
          console.log(`🗑️  Removed existing player: ${p.email}`);
        }
      }

      const id = await upsertPlayer(tx, p);
      console.log(`✅ Ensured player: ${p.email} (id=${id})`);
    }
  });

  console.log("🌱 Database seed completed successfully.");
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const reset = args.includes("--reset") || args.includes("-r");

    if (reset) console.log("⚠️  Running in reset mode: existing users will be removed first.");

    await seedAll(reset);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
