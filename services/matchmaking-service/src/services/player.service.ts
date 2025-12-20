import axios from "axios";
import { config } from "../config/env.js";

export const verifyToken = async (token: string) => {
  const res = await axios.post(
    `${config.playerServiceUrl}/api/auth/verify`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const canJoin = async (playerId: number) => {
  const res = await axios.get(
    `${config.playerServiceUrl}/api/users/can-join`,
    { params: { playerId } }
  );
  return res.data;
};
