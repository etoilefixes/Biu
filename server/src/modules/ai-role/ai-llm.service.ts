import { prisma } from '../../config/database';
import { getIo } from '../../socket';
import { ReasoningStreamParser, AiStreamChunk } from './reasoning-parser';

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
  reasoningEffort: string;
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
      reasoningEffort: (dbConfig as any).reasoningEffort || 'high',
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
    reasoningEffort: process.env.AI_REASONING_EFFORT || 'high',
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
    if (globalConfig.streamingEnabled) {
      await streamLLMAndReply(globalConfig, finalModel, llmMessages, temperature, maxTokens, conversationId, aiUser.id, useReasoning);
    } else {
      await nonStreamLLMAndReply(globalConfig, finalModel, llmMessages, temperature, maxTokens, conversationId, aiUser.id, useReasoning);
    }
  } catch (err) {
    console.error('[AI Reply] Failed to generate reply:', err);
  }
}

/**
 * 流式调用 LLM 并逐步推送 + 最终写入数据库
 */
async function streamLLMAndReply(
  config: ModelConfig,
  model: string,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  conversationId: string,
  aiUserId: string,
  useReasoning: boolean,
) {
  if (!config.apiKey && config.provider !== 'ollama') {
    await emitErrorAndSaveFallback(conversationId, aiUserId, 'AI 服务未配置，请联系管理员设置 API Key');
    return;
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  // DeepSeek V4 thinking 参数适配
  if (useReasoning) {
    if (config.provider === 'deepseek' || config.provider === 'openai-compatible') {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = config.reasoningEffort || 'high';
    }
  }

  const reasoningMode = useReasoning ? config.reasoningMode : 'none';
  const parser = new ReasoningStreamParser(reasoningMode);

  const io = getIo();
  const { redis } = await import('../../config/redis');

  // 获取会话成员的 socket ID
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const memberSocketIds: Map<string, string | null> = new Map();
  for (const member of members) {
    const socketId = await redis.get(`user:socket:${member.userId}`);
    memberSocketIds.set(member.userId, socketId);
  }

  // 发送流式开始事件
  for (const [, socketId] of memberSocketIds) {
    if (socketId) {
      io.to(socketId).emit('chat:stream', {
        conversationId,
        type: 'start',
        aiUserId,
      });
    }
  }

  let contentBuffer = '';
  let reasoningBuffer = '';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Stream] API error:', response.status, errorText);
      await emitErrorAndSaveFallback(conversationId, aiUserId, 'AI 服务暂时不可用');
      return;
    }

    if (!response.body) {
      await emitErrorAndSaveFallback(conversationId, aiUserId, 'AI 服务返回异常');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const choice = chunk.choices?.[0];

          if (!choice) continue;

          // 检查是否结束
          if (choice.finish_reason) {
            continue;
          }

          const parsedChunks = parser.feed(chunk);

          for (const pc of parsedChunks) {
            if (pc.type === 'reasoning' && pc.delta) {
              reasoningBuffer += pc.delta;

              // 根据配置决定是否推送推理内容
              if (config.reasoningDisplay !== 'hidden') {
                for (const [, socketId] of memberSocketIds) {
                  if (socketId) {
                    io.to(socketId).emit('chat:stream', {
                      conversationId,
                      type: 'reasoning',
                      delta: pc.delta,
                    });
                  }
                }
              }
            } else if (pc.type === 'content' && pc.delta) {
              contentBuffer += pc.delta;

              // 推送内容增量
              for (const [, socketId] of memberSocketIds) {
                if (socketId) {
                  io.to(socketId).emit('chat:stream', {
                    conversationId,
                    type: 'content',
                    delta: pc.delta,
                  });
                }
              }
            }
          }
        } catch {
          // 解析失败的 chunk 忽略
        }
      }
    }
  } catch (err) {
    console.error('[LLM Stream] Error:', err);
    if (!contentBuffer) {
      await emitErrorAndSaveFallback(conversationId, aiUserId, 'AI 服务连接失败');
      return;
    }
  }

  // 流结束，发送 done 事件
  for (const [, socketId] of memberSocketIds) {
    if (socketId) {
      io.to(socketId).emit('chat:stream', {
        conversationId,
        type: 'done',
        reasoning: reasoningBuffer || undefined,
        content: contentBuffer || undefined,
      });
    }
  }

  // 保存最终回复到数据库
  const finalContent = contentBuffer || '（AI 暂时无法回复）';
  await saveAndBroadcastMessage(conversationId, aiUserId, finalContent, reasoningBuffer, config.reasoningDisplay);
}

/**
 * 非流式调用 LLM（fallback）
 */
async function nonStreamLLMAndReply(
  config: ModelConfig,
  model: string,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  conversationId: string,
  aiUserId: string,
  useReasoning: boolean,
) {
  const reply = await callLLM(config, model, messages, temperature, maxTokens, useReasoning);
  await saveAndBroadcastMessage(conversationId, aiUserId, reply, '', 'hidden');
}

/**
 * 保存 AI 回复消息并广播
 */
async function saveAndBroadcastMessage(
  conversationId: string,
  aiUserId: string,
  content: string,
  reasoningContent: string,
  reasoningDisplay: string,
) {
  // 如果配置为可见，将思考内容附加到消息中（用特殊标记）
  let finalContent = content;
  if (reasoningContent && reasoningDisplay !== 'hidden') {
    // 使用特殊标记存储思考内容，前端可以解析
    finalContent = content;
    // 思考内容单独存储在 cardData 中
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: aiUserId,
      content: finalContent,
      type: 'text',
      // 将思考内容存储在 cardData 中
      cardType: reasoningContent && reasoningDisplay !== 'hidden' ? 'ai_reasoning' : null,
      cardData: reasoningContent && reasoningDisplay !== 'hidden'
        ? JSON.stringify({ reasoning: reasoningContent })
        : null,
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

  // WebSocket 推送完整消息
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

    if (member.userId !== aiUserId) {
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
}

/**
 * 发送错误事件并保存 fallback 消息
 */
async function emitErrorAndSaveFallback(conversationId: string, aiUserId: string, errorMsg: string) {
  const io = getIo();
  const { redis } = await import('../../config/redis');

  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  for (const member of members) {
    const socketId = await redis.get(`user:socket:${member.userId}`);
    if (socketId) {
      io.to(socketId).emit('chat:stream', {
        conversationId,
        type: 'error',
        message: errorMsg,
      });
    }
  }

  await saveAndBroadcastMessage(conversationId, aiUserId, `（${errorMsg}）`, '', 'hidden');
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
 * AI Provider 适配层 — OpenAI Compatible 接口（非流式）
 * 支持 DeepSeek、通义千问、Ollama 等所有兼容 OpenAI 格式的服务
 */
async function callLLM(
  config: ModelConfig,
  model: string,
  messages: LLMMessage[],
  temperature: number = 0.7,
  maxTokens: number = 2000,
  useReasoning: boolean = false,
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

  // DeepSeek V4 thinking 参数适配
  if (useReasoning) {
    if (config.provider === 'deepseek' || config.provider === 'openai-compatible') {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = config.reasoningEffort || 'high';
    }
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

  const mainContent = choice.message?.content || '（AI 暂时无法回复）';

  // 非流式模式下，处理 think-tag 推理内容
  if (useReasoning && config.reasoningMode === 'think-tag') {
    const thinkTagRegex = /<think[^>]*>([\s\S]*?)<\/think>/g;
    const cleaned = mainContent.replace(thinkTagRegex, '').trim();
    return cleaned || mainContent;
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
