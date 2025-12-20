import { Router } from "express";
import { join, leave } from "../controllers/matchmaking.controller.js";

const router = Router();
router.post("/join", join);
router.post("/leave", leave); 

export default router;
