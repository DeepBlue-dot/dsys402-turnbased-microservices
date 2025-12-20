import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
  {
    matchId: { type: String, unique: true },
    players: [String],

    board: {
      type: [String],
      default: Array(9).fill(null),
    },

    symbols: {
      type: Map,
      of: String, // X | O
    },

    turn: String,

    status: {
      type: String,
      enum: ["INITIALIZED", "IN_PROGRESS", "PAUSED", "FINISHED", "CANCELLED"],
      default: "INITIALIZED",
      required: true,
    },

    pausedBy: { type: String }, // playerId
    pauseUntil: { type: Date },

    winnerId: String,
  },
  { timestamps: true }
);

export const Game = mongoose.model("Game", GameSchema);
