import { Router } from "express";
import { server } from "../app.js";

const router = Router();
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "gateway-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
