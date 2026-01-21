import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./env.js";

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
});

export const prisma = new PrismaClient({ adapter });
