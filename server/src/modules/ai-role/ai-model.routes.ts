import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  listModels,
  createModel,
  updateModel,
  deleteModel,
  testModel,
  fetchRemoteModels,
} from './ai-model.controller';

const router = Router();

router.get('/models', authMiddleware, listModels);
router.post('/models/fetch-remote', authMiddleware, fetchRemoteModels);
router.post('/models', authMiddleware, createModel);
router.put('/models/:id', authMiddleware, updateModel);
router.delete('/models/:id', authMiddleware, deleteModel);
router.post('/models/:id/test', authMiddleware, testModel);

export default router;
