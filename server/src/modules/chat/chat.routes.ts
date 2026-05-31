import { Router } from 'express';
import * as chatController from './chat.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, chatController.list);
router.post('/', authMiddleware, chatController.create);
router.put('/read-all', authMiddleware, chatController.markAllRead);
router.get('/:id', authMiddleware, chatController.detail);
router.put('/:id/read', authMiddleware, chatController.markRead);
router.delete('/:id', authMiddleware, chatController.remove);

export default router;
