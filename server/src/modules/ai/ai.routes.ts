import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './ai.controller';

const router = Router();

router.post('/quick-send', authMiddleware, controller.quickSend);
router.get('/recent', authMiddleware, controller.getRecent);
router.get('/find-user/:biuId', authMiddleware, controller.findUser);

export default router;
