import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './ai-role.controller';

const router = Router();

router.get('/', authMiddleware, controller.listRoles);
router.post('/', authMiddleware, controller.createRole);
router.get('/:id', authMiddleware, controller.getRole);
router.put('/:id', authMiddleware, controller.updateRole);
router.delete('/:id', authMiddleware, controller.deleteRole);
router.post('/:id/chat', authMiddleware, controller.chatWithRole);

export default router;
