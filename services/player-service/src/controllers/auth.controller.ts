import { Request, Response } from "express";
import { playerService } from "../services/player.service.js";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await playerService.register(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const token = await playerService.login(req.body);
    res.json({ token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || "";
  playerService.logout().then((r) => res.json(r));
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "No token provided" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const newToken = await playerService.refreshToken(token);
    res.json({ token: newToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}