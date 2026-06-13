import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as aiLlmService from './ai-llm.service';
import { prisma } from '../../config/database';
import { getFullConfig } from './ai-model-resolver';

/** 获取全局 AI 配置（不返回 API Key） */
export async function getConfig(req: AuthRequest, res: Response) {
  try {
    const fullConfig = await getFullConfig();

    if (!fullConfig) {
      // 返回环境变量 fallback
      res.json({
        code: 200,
        data: {
          chatModel: null,
          reasoningModel: null,
          arbitrationModel: null,
          reasoningEnabled: process.env.AI_REASONING_ENABLED === 'true',
          reasoningMode: process.env.AI_REASONING_MODE || 'none',
          reasoningDisplay: process.env.AI_REASONING_DISPLAY || 'hidden',
          reasoningEffort: process.env.AI_REASONING_EFFORT || 'high',
          streamingEnabled: process.env.AI_STREAMING !== 'false',
          contextMessageLimit: 20,
          arbitrationMaxTokens: 200,
          includePrivateContext: false,
          aiTriggerMode: 'always',
          source: 'env',
        },
      });
      return;
    }

    res.json({
      code: 200,
      data: {
        ...fullConfig,
        source: 'database',
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

/** 保存全局 AI 配置（只保存用途引用和行为配置） */
export async function saveConfig(req: AuthRequest, res: Response) {
  try {
    const data = req.body;

    const configData: any = {
      chatModelId: data.chatModelId || null,
      reasoningModelId: data.reasoningModelId || null,
      arbitrationModelId: data.arbitrationModelId || null,
      reasoningEnabled: data.reasoningEnabled ?? false,
      reasoningMode: data.reasoningMode || 'none',
      reasoningDisplay: data.reasoningDisplay || 'hidden',
      reasoningEffort: data.reasoningEffort || 'high',
      streamingEnabled: data.streamingEnabled ?? true,
      contextMessageLimit: data.contextMessageLimit ?? 20,
      arbitrationMaxTokens: data.arbitrationMaxTokens ?? 200,
      includePrivateContext: data.includePrivateContext ?? false,
      aiTriggerMode: data.aiTriggerMode || 'always',
    };

    const existing = await prisma.aiModelConfig.findFirst();

    let config;
    if (existing) {
      config = await prisma.aiModelConfig.update({
        where: { id: existing.id },
        data: configData,
        include: {
          chatModelRef: true,
          reasoningModelRef: true,
          arbitrationModelRef: true,
        },
      });
    } else {
      config = await prisma.aiModelConfig.create({
        data: configData,
        include: {
          chatModelRef: true,
          reasoningModelRef: true,
          arbitrationModelRef: true,
        },
      });
    }

    // 返回格式化的配置
    const fullConfig = await getFullConfig();
    res.json({
      code: 200,
      message: '保存成功',
      data: fullConfig,
    });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

/** 测试 AI 连接 */
export async function testConfigConnection(req: AuthRequest, res: Response) {
  try {
    const result = await aiLlmService.testConnection(req.body);
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}
