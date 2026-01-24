import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getGameHistory, getMatchById } from "../controllers/history.controller.js";

const router = Router();
router.get("/me", authMiddleware, getGameHistory);
router.get("/:matchId", authMiddleware, getMatchById);

export default router;
