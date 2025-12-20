import axios from "axios";
import { config } from "../config/env.js";
import { VerifyResult } from "../types/VerifyResult.interface.js";

export const verifyToken = async (
  token: string
): Promise<VerifyResult> => {
  try {
    const res = await axios.post(
      `${config.playerServiceUrl}/api/auth/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 3000,
      }
    );

    return res.data;
  } catch (err: any) {
    console.error(
      "[WS] Token verification failed:",
      err.response?.data || err.message
    );

    return { valid: false };
  }
};
