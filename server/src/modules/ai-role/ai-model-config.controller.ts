import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as aiLlmService from './ai-llm.service';
import { prisma } from '../../config/database';

/** 获取全局 AI 配置（不返回 API Key） */
export async function getConfig(req: AuthRequest, res: Response) {
  try {
    const config = await prisma.aiModelConfig.findFirst();

    if (!config) {
      // 返回环境变量 fallback
      res.json({
        code: 200,
        data: {
          provider: process.env.AI_PROVIDER || 'openai-compatible',
          baseUrl: process.env.AI_BASE_URL || '',
          hasApiKey: !!process.env.AI_API_KEY,
          chatModel: process.env.AI_CHAT_MODEL || '',
          reasoningModel: process.env.AI_REASONING_MODEL || null,
          reasoningEnabled: process.env.AI_REASONING_ENABLED === 'true',
          reasoningMode: process.env.AI_REASONING_MODE || 'none',
          reasoningDisplay: process.env.AI_REASONING_DISPLAY || 'hidden',
          streamingEnabled: process.env.AI_STREAMING !== 'false',
          temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
          source: 'env',
        },
      });
      return;
    }

    res.json({
      code: 200,
      data: {
        id: config.id,
        provider: config.provider,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKeyEncrypted,
        chatModel: config.chatModel,
        reasoningModel: config.reasoningModel,
        reasoningEnabled: config.reasoningEnabled,
        reasoningMode: config.reasoningMode,
        reasoningDisplay: config.reasoningDisplay,
        streamingEnabled: config.streamingEnabled,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        source: 'database',
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

/** 保存全局 AI 配置 */
export async function saveConfig(req: AuthRequest, res: Response) {
  try {
    const data = req.body;

    const configData: any = {
      provider: data.provider || 'openai-compatible',
      baseUrl: data.baseUrl || '',
      chatModel: data.chatModel || '',
      reasoningModel: data.reasoningModel || null,
      reasoningEnabled: data.reasoningEnabled ?? false,
      reasoningMode: data.reasoningMode || 'none',
      reasoningDisplay: data.reasoningDisplay || 'hidden',
      streamingEnabled: data.streamingEnabled ?? true,
      temperature: data.temperature ?? 0.7,
      maxTokens: data.maxTokens ?? 2000,
    };

    // 只在提供了新 API Key 时更新
    if (data.apiKey) {
      configData.apiKeyEncrypted = data.apiKey;
    }

    const existing = await prisma.aiModelConfig.findFirst();

    let config;
    if (existing) {
      config = await prisma.aiModelConfig.update({
        where: { id: existing.id },
        data: configData,
      });
    } else {
      config = await prisma.aiModelConfig.create({
        data: configData,
      });
    }

    res.json({
      code: 200,
      message: '保存成功',
      data: {
        id: config.id,
        provider: config.provider,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKeyEncrypted,
        chatModel: config.chatModel,
        reasoningModel: config.reasoningModel,
        reasoningEnabled: config.reasoningEnabled,
        reasoningMode: config.reasoningMode,
        reasoningDisplay: config.reasoningDisplay,
        streamingEnabled: config.streamingEnabled,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
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
