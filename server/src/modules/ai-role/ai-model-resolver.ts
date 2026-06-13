import { prisma } from '../../config/database';

export type ModelPurpose = 'chat' | 'reasoning' | 'arbitration';

export interface ResolvedAiModel {
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
}

// 从环境变量 fallback 解析模型
function resolveModelFromEnv(): ResolvedAiModel {
  return {
    provider: process.env.AI_PROVIDER || 'openai-compatible',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    modelName: process.env.AI_CHAT_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  };
}

// 按用途解析模型
export async function resolveAiModelForPurpose(purpose: ModelPurpose): Promise<ResolvedAiModel> {
  const config = await prisma.aiModelConfig.findFirst({
    include: {
      chatModelRef: true,
      reasoningModelRef: true,
      arbitrationModelRef: true,
    },
  });

  if (!config) return resolveModelFromEnv();

  let model = null;
  if (purpose === 'chat') {
    model = config.chatModelRef;
  } else if (purpose === 'reasoning') {
    model = config.reasoningModelRef ?? config.chatModelRef;
  } else if (purpose === 'arbitration') {
    model = config.arbitrationModelRef ?? config.chatModelRef;
  }

  if (!model) return resolveModelFromEnv();

  return {
    provider: model.provider,
    baseUrl: model.baseUrl,
    apiKey: model.apiKeyEncrypted || '',
    modelName: model.modelName,
    maxTokens: model.maxTokens,
    temperature: model.temperature,
  };
}

// 获取完整的全局配置（包含行为配置 + 解析后的模型）
export async function getFullConfig() {
  const config = await prisma.aiModelConfig.findFirst({
    include: {
      chatModelRef: true,
      reasoningModelRef: true,
      arbitrationModelRef: true,
    },
  });

  if (!config) return null;

  return {
    chatModel: config.chatModelRef ? {
      id: config.chatModelRef.id,
      name: config.chatModelRef.name,
      provider: config.chatModelRef.provider,
      baseUrl: config.chatModelRef.baseUrl,
      hasApiKey: !!config.chatModelRef.apiKeyEncrypted,
      modelName: config.chatModelRef.modelName,
      maxTokens: config.chatModelRef.maxTokens,
      temperature: config.chatModelRef.temperature,
    } : null,
    reasoningModel: config.reasoningModelRef ? {
      id: config.reasoningModelRef.id,
      name: config.reasoningModelRef.name,
      provider: config.reasoningModelRef.provider,
      baseUrl: config.reasoningModelRef.baseUrl,
      hasApiKey: !!config.reasoningModelRef.apiKeyEncrypted,
      modelName: config.reasoningModelRef.modelName,
      maxTokens: config.reasoningModelRef.maxTokens,
      temperature: config.reasoningModelRef.temperature,
    } : null,
    arbitrationModel: config.arbitrationModelRef ? {
      id: config.arbitrationModelRef.id,
      name: config.arbitrationModelRef.name,
      provider: config.arbitrationModelRef.provider,
      baseUrl: config.arbitrationModelRef.baseUrl,
      hasApiKey: !!config.arbitrationModelRef.apiKeyEncrypted,
      modelName: config.arbitrationModelRef.modelName,
      maxTokens: config.arbitrationModelRef.maxTokens,
      temperature: config.arbitrationModelRef.temperature,
    } : null,
    reasoningEnabled: config.reasoningEnabled,
    reasoningMode: config.reasoningMode,
    reasoningDisplay: config.reasoningDisplay,
    reasoningEffort: config.reasoningEffort,
    streamingEnabled: config.streamingEnabled,
    contextMessageLimit: config.contextMessageLimit,
    arbitrationMaxTokens: config.arbitrationMaxTokens,
    includePrivateContext: config.includePrivateContext,
    aiTriggerMode: config.aiTriggerMode,
  };
}
