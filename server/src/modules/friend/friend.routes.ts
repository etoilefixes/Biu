import { Router } from 'express';
import * as friendController from './friend.controller';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { sendFriendRequestSchema, handleFriendRequestSchema } from './friend.schema';

const router = Router();

router.post('/request', authMiddleware, validate(sendFriendRequestSchema), friendController.sendRequest);
router.put('/request/:id', authMiddleware, validate(handleFriendRequestSchema), friendController.handleRequest);
router.delete('/:friendId', authMiddleware, friendController.deleteFriend);
router.get('/requests', authMiddleware, friendController.listRequests);
router.get('/', authMiddleware, friendController.listFriends);

export default router;
