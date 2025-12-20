export interface MatchCreatedEvent {
  event: "match_created";
  matchId: string;
  players: string[];
}
