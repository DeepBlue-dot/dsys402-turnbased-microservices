export const matchRooms = new Map<string, Set<string>>();

export const joinRoom = (matchId: string, playerId: string) => {
  if (!matchRooms.has(matchId)) {
    matchRooms.set(matchId, new Set());
  }
  matchRooms.get(matchId)!.add(playerId);
};

export const leaveRoom = (matchId: string, playerId: string) => {
  const room = matchRooms.get(matchId);
  if (!room) return;

  room.delete(playerId);

  if (room.size === 0) {
    matchRooms.delete(matchId);
  }
};

export const removeRoom = (matchId: string) => {
  matchRooms.delete(matchId);
};

export const getRoomPlayers = (matchId: string): string[] => {
  return Array.from(matchRooms.get(matchId) || []);
};
