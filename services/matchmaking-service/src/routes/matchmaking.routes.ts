import { Router } from "express";
import { join, leave } from "../controllers/matchmaking.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/join", authMiddleware, join);
router.post("/leave", authMiddleware, leave); 

export default router;
