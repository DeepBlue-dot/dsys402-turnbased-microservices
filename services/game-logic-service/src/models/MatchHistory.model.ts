import mongoose, { Schema, Document } from "mongoose";

export interface IMatchHistory extends Document {
  matchId: string;
  players: string[];
  winnerId: string | null; // null indicates a Draw
  finalBoard: string[];    // 9 strings: ['X', 'O', '', ...]
  reason: "COMPLETED" | "FORFEIT" | "TIMEOUT";
  endedAt: Date;
}

const MatchHistorySchema = new Schema<IMatchHistory>({
  matchId: { type: String, required: true, unique: true },
  players: { type: [String], required: true, index: true }, // Index for fast "my history" queries
  winnerId: { type: String, default: null },
  finalBoard: { type: [String], required: true },
  reason: { type: String, enum: ["COMPLETED", "FORFEIT", "TIMEOUT"], required: true },
  endedAt: { type: Date, default: Date.now }
});

export const MatchHistory = mongoose.model<IMatchHistory>("MatchHistory", MatchHistorySchema);