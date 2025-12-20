import dotenv from "dotenv";
import { defineConfig } from "@prisma/config";
dotenv.config();

export default defineConfig({
  migrations: {
    seed: "ts-node ./prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
