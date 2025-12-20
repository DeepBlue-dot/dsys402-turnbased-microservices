import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllUsers, getUserById, updateUser, deleteUser, getTheUser, canJoinMatchmaking } from '../controllers/user.controller.js';


const router = Router();

router.get("/can-join", canJoinMatchmaking);
router.get("/me", authMiddleware, getTheUser);
router.get('/', authMiddleware, getAllUsers);
router.get('/:id', authMiddleware, getUserById);
router.put('/:id', authMiddleware, updateUser);
router.delete('/:id', authMiddleware, deleteUser);


export default router;