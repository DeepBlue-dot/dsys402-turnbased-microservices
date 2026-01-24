import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validate } from "../validators/player.validator.js";

import {
  deleteMyAccount,
  getMyData,
  getPublicProfile,
  getPublicStats,
  searchPlayers,
  updateMyEmail,
  updateMyPassword,
  updateMyProfile,
} from "../controllers/player.controller.js";

import {
  updateProfileSchema,
  updateEmailSchema,
  updatePasswordSchema,
} from "../validators/player.validator.js";

const router = Router();

// ---- Authenticated user routes ----
router.get("/me", authMiddleware, getMyData);

router.put(
  "/me/profile",
  authMiddleware,
  validate(updateProfileSchema),
  updateMyProfile
);

router.put(
  "/me/email",
  authMiddleware,
  validate(updateEmailSchema),
  updateMyEmail
);

router.put(
  "/me/password",
  authMiddleware,
  validate(updatePasswordSchema),
  updateMyPassword
);

router.delete("/me", authMiddleware, deleteMyAccount);

// ---- Public routes ----
router.get("/search", searchPlayers);
router.get("/:id/profile", getPublicProfile);
router.get("/:id/stats", getPublicStats);

export default router;
