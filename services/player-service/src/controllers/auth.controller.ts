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
  playerService.logout(token).then((r) => res.json(r));
};

export const verify = async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      res.status(401).json({ valid: false });
      return;
    }

    const token = header.replace("Bearer ", "");
    const result = await playerService.verifyToken(token);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ 
      valid: false, 
      error: err.message 
    });
  }
};