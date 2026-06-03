import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './official.controller';

const router = Router();

router.get('/users', authMiddleware, controller.getAllUsers);
router.delete('/users/:id', authMiddleware, controller.deleteUser);
router.post('/channels', authMiddleware, controller.createOfficialChannel);
router.post('/broadcast', authMiddleware, controller.sendBroadcast);
router.put('/users/:id/role', authMiddleware, controller.setUserRole);
router.put('/users/:id/official-status', authMiddleware, controller.setUserOfficialStatus);

export default router;
