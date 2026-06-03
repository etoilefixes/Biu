import { prisma } from '../../config/database';
import { getIo } from '../../socket';

const CONTEXT_MESSAGE_LIMIT = 20;

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  reasoningModel: string | null;
  reasoningEnabled: boolean;
  reasoningMode: string;
  reasoningDisplay: string;
  streamingEnabled: boolean;
  temperature: number;
  maxTokens: number;
}

/**
 * 获取全局 AI 模型配置
 * 优先从数据库读取，fallback 到环境变量
 */
async function getGlobalConfig(): Promise<ModelConfig> {
  const dbConfig = await prisma.aiModelConfig.findFirst();

  if (dbConfig) {
    return {
      provider: dbConfig.provider,
      baseUrl: dbConfig.baseUrl,
      apiKey: dbConfig.apiKeyEncrypted || '',
      chatModel: dbConfig.chatModel,
      reasoningModel: dbConfig.reasoningModel,
      reasoningEnabled: dbConfig.reasoningEnabled,
      reasoningMode: dbConfig.reasoningMode,
      reasoningDisplay: dbConfig.reasoningDisplay,
      streamingEnabled: dbConfig.streamingEnabled,
      temperature: dbConfig.temperature,
      maxTokens: dbConfig.maxTokens,
    };
  }

  // Fallback 到环境变量
  return {
    provider: process.env.AI_PROVIDER || 'openai-compatible',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    chatModel: process.env.AI_CHAT_MODEL || 'gpt-3.5-turbo',
    reasoningModel: process.env.AI_REASONING_MODEL || null,
    reasoningEnabled: process.env.AI_REASONING_ENABLED === 'true',
    reasoningMode: process.env.AI_REASONING_MODE || 'none',
    reasoningDisplay: process.env.AI_REASONING_DISPLAY || 'hidden',
    streamingEnabled: process.env.AI_STREAMING !== 'false',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
  };
}

/**
 * 当用户在 AI 角色会话中发送消息后，调用此函数生成 AI 回复
 */
export async function generateAiReply(conversationId: string, senderId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || !conversation.name?.startsWith('__ai_role__')) {
    return;
  }

  const roleId = conversation.name.replace('__ai_role__', '');
  const role = await prisma.aiRole.findUnique({ where: { id: roleId } });
  if (!role) return;

  const aiUsername = `ai_role_${roleId.replace(/-/g, '_')}`;
  const aiUser = await prisma.user.findUnique({ where: { username: aiUsername } });
  if (!aiUser) return;

  if (senderId === aiUser.id) return;

  // 获取最近消息作为上下文
  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_MESSAGE_LIMIT,
    include: {
      sender: {
        select: { id: true, nickname: true },
      },
    },
  });

  recentMessages.reverse();

  // 获取全局配置
  const globalConfig = await getGlobalConfig();

  // 决定使用的模型：角色有配置用角色的，否则用全局的
  const useModel = role.model || globalConfig.chatModel;
  const useReasoning = role.useReasoning && globalConfig.reasoningEnabled;
  const finalModel = useReasoning ? (globalConfig.reasoningModel || useModel) : useModel;
  const temperature = role.temperature ?? globalConfig.temperature;
  const maxTokens = role.maxTokens ?? globalConfig.maxTokens;

  // 构建 system prompt
  const systemPrompt = buildSystemPrompt(role);
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of recentMessages) {
    const isAi = msg.senderId === aiUser.id;
    llmMessages.push({
      role: isAi ? 'assistant' : 'user',
      content: isAi ? msg.content : `${msg.sender.nickname}: ${msg.content}`,
    });
  }

  try {
    const reply = await callLLM(globalConfig, finalModel, llmMessages, temperature, maxTokens);

    // 保存 AI 回复
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: aiUser.id,
        content: reply,
        type: 'text',
      },
      include: {
        sender: {
          select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
        },
      },
    });

    const formattedMessage = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type as 'text',
      cardType: message.cardType,
      cardData: message.cardData ? JSON.parse(message.cardData) : null,
      mentions: message.mentions ? JSON.parse(message.mentions) : null,
      mentionsAll: message.mentionsAll,
      createdAt: message.createdAt.toISOString(),
      sender: {
        ...message.sender,
        status: message.sender.status as 'online' | 'offline' | 'away',
        isSystem: message.sender.isSystem || false,
        badges: message.sender.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    };

    // WebSocket 推送
    const io = getIo();
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const { redis } = await import('../../config/redis');
    for (const member of members) {
      const socketId = await redis.get(`user:socket:${member.userId}`);
      if (socketId) {
        io.to(socketId).emit('chat:message', formattedMessage);
      }

      if (member.userId !== aiUser.id) {
        const unreadKey = `unread:${member.userId}:${conversationId}`;
        const current = parseInt(await redis.get(unreadKey) || '0', 10);
        await redis.set(unreadKey, String(current + 1));

        const memberSocketId = await redis.get(`user:socket:${member.userId}`);
        if (memberSocketId) {
          io.to(memberSocketId).emit('chat:unread', {
            conversationId,
            count: current + 1,
          });
        }
      }
    }
  } catch (err) {
    console.error('[AI Reply] Failed to generate reply:', err);
  }
}

function buildSystemPrompt(role: {
  name: string;
  description: string | null;
  systemPrompt: string | null;
  speakingStyle: string | null;
  forbiddenTopics: string | null;
  replyLength: string;
}): string {
  const parts: string[] = [];

  parts.push(`你是${role.name}。`);

  if (role.systemPrompt) {
    parts.push(role.systemPrompt);
  }

  if (role.description) {
    parts.push(`角色描述：${role.description}`);
  }

  if (role.speakingStyle) {
    parts.push(`说话风格：${role.speakingStyle}`);
  }

  if (role.forbiddenTopics) {
    parts.push(`禁止事项：${role.forbiddenTopics}`);
  }

  const lengthGuide: Record<string, string> = {
    short: '回复尽量简短，1-2句话。',
    medium: '回复适中，2-4句话。',
    long: '回复可以详细，5句话以上。',
  };
  parts.push(lengthGuide[role.replyLength] || lengthGuide.medium);

  parts.push('请始终保持角色设定，不要跳出角色。');

  return parts.join('\n');
}

/**
 * AI Provider 适配层 — OpenAI Compatible 接口
 * 支持 DeepSeek、通义千问、Ollama 等所有兼容 OpenAI 格式的服务
 */
async function callLLM(
  config: ModelConfig,
  model: string,
  messages: LLMMessage[],
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  if (!config.apiKey && config.provider !== 'ollama') {
    return '（AI 服务未配置，请联系管理员设置 API Key）';
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // 思考模型适配
  if (config.reasoningEnabled && config.reasoningMode === 'field') {
    // DeepSeek 等支持 reasoning_content 字段
    // 不需要额外参数，模型自动返回
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM] API error:', response.status, errorText);
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();

  // 提取回复内容
  const choice = data.choices?.[0];
  if (!choice) throw new Error('LLM 返回数据格式异常');

  // 处理思考模型的 reasoning_content
  const reasoningContent = choice.message?.reasoning_content;
  const mainContent = choice.message?.content || '（AI 暂时无法回复）';

  // 根据配置决定是否附加思考内容
  if (reasoningContent && config.reasoningDisplay === 'visible') {
    return `${mainContent}\n\n---\n💭 思考过程：${reasoningContent}`;
  }

  return mainContent;
}

/**
 * 测试 AI 连接
 */
export async function testConnection(config: Partial<ModelConfig>): Promise<{ success: boolean; message: string; models?: string[] }> {
  try {
    const url = `${(config.baseUrl || '').replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {};

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      return { success: false, message: `连接失败: HTTP ${response.status}` };
    }

    const data = await response.json();
    const models = (data.data || []).map((m: any) => m.id).slice(0, 20);

    return { success: true, message: '连接成功', models };
  } catch (err: any) {
    return { success: false, message: `连接失败: ${err.message}` };
  }
}
