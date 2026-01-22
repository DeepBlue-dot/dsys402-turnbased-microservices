import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getGameHistory } from "../controllers/history.controller.js";

const router = Router();
router.get("/me", authMiddleware, getGameHistory);

export default router;
