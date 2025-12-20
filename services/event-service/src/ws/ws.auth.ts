import { verifyToken } from "../services/player.service.js";

export const authenticateWS = async (token?: string) => {
  if (!token) throw new Error("Missing token");

  const result = await verifyToken(token);

  if (!result.valid || !result.user?.id) {
    throw new Error("Invalid token");
  }

  return result.user.id; 
};
