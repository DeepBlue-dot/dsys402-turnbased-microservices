import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { deleteMyAccount, getMyData, getPublicProfile, getPublicStats, searchPlayers, updateMyEmail, updateMyPassword, updateMyProfile } from '../controllers/player.controller.js';

const router = Router();

router.get("/me", authMiddleware, getMyData);
router.put("/me/profile", authMiddleware, updateMyProfile);
router.put("/me/email", authMiddleware, updateMyEmail);
router.put("/me/password", authMiddleware, updateMyPassword);
router.delete("/me", authMiddleware, deleteMyAccount);

router.get("/", searchPlayers);
router.get("/:id/profile", getPublicProfile);
router.get("/:id/stats", getPublicStats);

export default router;