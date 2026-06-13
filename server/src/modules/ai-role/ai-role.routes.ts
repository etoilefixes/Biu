import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './ai-role.controller';
import * as modelConfigController from './ai-model-config.controller';
import modelRoutes from './ai-model.routes';

const router = Router();

// AI 模型库路由
router.use(modelRoutes);

// AI 模型配置路由（放在 /:id 之前，避免被 :id 匹配）
router.get('/config/model', authMiddleware, modelConfigController.getConfig);
router.put('/config/model', authMiddleware, modelConfigController.saveConfig);
router.post('/config/test', authMiddleware, modelConfigController.testConfigConnection);

// AI 会话操作路由（放在 /:id 之前）
router.delete('/conversations/:conversationId/messages', authMiddleware, controller.clearConversationMessages);
router.post('/conversations/:conversationId/regenerate', authMiddleware, controller.regenerateLastReply);

// AI 角色路由
router.get('/', authMiddleware, controller.listRoles);
router.post('/', authMiddleware, controller.createRole);
router.get('/:id', authMiddleware, controller.getRole);
router.put('/:id', authMiddleware, controller.updateRole);
router.delete('/:id', authMiddleware, controller.deleteRole);
router.post('/:id/chat', authMiddleware, controller.chatWithRole);

export default router;
