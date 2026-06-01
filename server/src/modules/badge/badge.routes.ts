import { Router } from 'express';
import * as badgeController from './badge.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, badgeController.listBadges);
router.get('/user/:userId', authMiddleware, badgeController.getUserBadges);
router.post('/assign', authMiddleware, badgeController.assignBadge);

export default router;
