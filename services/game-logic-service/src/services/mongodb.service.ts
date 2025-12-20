import mongoose from "mongoose";
import { config } from "../config/env.js";

export const connectMongo = async () => {
  await mongoose.connect(config.mongoUri);
  console.log("[GameLogic] MongoDB connected");
};
