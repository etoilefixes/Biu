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
router.post('/:id/members', authMiddleware, chatController.addMember);
router.put('/:id/name', authMiddleware, chatController.updateName);
router.put('/:id/nickname', authMiddleware, chatController.updateNickname);
router.put('/:id/announcement', authMiddleware, chatController.setAnnouncement);
router.delete('/:id/members', authMiddleware, chatController.removeMember);
router.post('/:id/leave', authMiddleware, chatController.leaveGroup);
router.delete('/:id/dissolve', authMiddleware, chatController.dissolveGroup);
router.put('/:id/role', authMiddleware, chatController.setRole);
router.put('/:id/transfer-owner', authMiddleware, chatController.transferOwner);

export default router;
