export type InvalidMoveReason =
  | "GAME_NOT_FOUND"
  | "GAME_NOT_ACTIVE"
  | "NOT_YOUR_TURN"
  | "CELL_OUT_OF_RANGE"
  | "CELL_OCCUPIED"
  | "PLAYER_NOT_IN_GAME";

export interface ValidationResult {
  valid: boolean;
  reason?: InvalidMoveReason;
}
