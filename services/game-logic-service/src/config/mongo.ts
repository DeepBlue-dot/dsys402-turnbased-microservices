import mongoose from "mongoose";
import { config } from "./env.js";

export const connectMongo = async () => {
  try {
    await mongoose.connect(config.mongoUri, {
      dbName: config.mongoDbName,
    });
    console.log("[MongoDB] Connected to Match History database");
  } catch (err) {
    console.error("[MongoDB] Connection error:", err);
    process.exit(1);
  }
};