import { Router } from 'express';
import * as messageController from './message.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/:conversationId', authMiddleware, messageController.list);
router.post('/:conversationId', authMiddleware, messageController.create);

export default router;
