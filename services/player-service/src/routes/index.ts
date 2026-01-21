import { Router } from "express";
import authRoutes from "./auth.routes.js";
import playerRoutes from "./player.routes.js";
const router = Router();

router.use("/auth", authRoutes);
router.use("/players", playerRoutes);

export default router;
