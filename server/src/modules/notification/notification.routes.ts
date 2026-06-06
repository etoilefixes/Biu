import { Router } from 'express';
import * as notificationController from './notification.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, notificationController.list);
router.post('/', authMiddleware, notificationController.upsert);
router.delete('/:id', authMiddleware, notificationController.remove);

export default router;
