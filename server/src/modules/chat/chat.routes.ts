import { Router } from 'express';
import * as chatController from './chat.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, chatController.list);
router.post('/', authMiddleware, chatController.create);
router.get('/:id', authMiddleware, chatController.detail);
router.put('/:id/read', authMiddleware, chatController.markRead);

export default router;
