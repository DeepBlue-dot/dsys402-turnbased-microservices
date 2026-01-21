import express from "express";
import matchmakingRoutes from "./routes/matchmaking.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const app = express();
app.use(express.json());
app.use("/", matchmakingRoutes);

export default app;
