import { Router } from 'express';
import * as userController from './user.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/search', authMiddleware, userController.search);
router.put('/profile', authMiddleware, userController.updateProfile);

export default router;
