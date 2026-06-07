import { prisma } from '../../config/database';
import { getIo } from '../../socket';
import { ReasoningStreamParser, AiStreamChunk } from './reasoning-parser';

const DEFAULT_CONTEXT_MESSAGE_LIMIT = 20;
const PRIVATE_CONTEXT_MESSAGE_LIMIT = 10;

// 智能触发常量
const AI_COOLDOWN_SECONDS = 15;       // AI 回复后冷却时间
const AI_MAX_CONSECUTIVE = 3;          // AI 最大连续回复次数
const AI_CHAT_SPEED_WINDOW = 60;       // 群聊速度计算窗口（秒）
const AI_FAST_CHAT_THRESHOLD = 8;      // 快速聊天阈值（条/分钟）

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 规则层1：快速信号提取结果 */
interface SignalExtraction {
  isMentioned: boolean;          // 是否 @提及 AI
  isReplyToAi: boolean;         // 是否回复 AI 的消息
  isQuestion: boolean;          // 是否是问题
  chatSpeed: number;            // 群聊速度（条/分钟）
  aiJustSpoke: boolean;         // AI 刚说过话
  aiConsecutiveCount: number;   // AI 连续回复次数
  interestTriggered: boolean;   // 是否触发兴趣/记忆/情绪
  hardProhibited: boolean;      // 是否硬性禁止发言
  messageContent: string;       // 消息内容
  senderNickname: string;       // 发送者昵称
}

/** LLM 仲裁层：结构化决策输出 */
interface ArbitrationDecision {
  shouldSpeak: boolean;
  action: 'reply' | 'interject' | 'emoji' | 'record_memory' | 'silence';
  targetUser: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  delayMs: number;
  reason: string;
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
  contextMessageLimit: number;
  includePrivateContext: boolean;
  aiTriggerMode: string;
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
      contextMessageLimit: (dbConfig as any).contextMessageLimit || DEFAULT_CONTEXT_MESSAGE_LIMIT,
      includePrivateContext: (dbConfig as any).includePrivateContext ?? false,
      aiTriggerMode: (dbConfig as any).aiTriggerMode || 'always',
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
    contextMessageLimit: DEFAULT_CONTEXT_MESSAGE_LIMIT,
    includePrivateContext: false,
    aiTriggerMode: 'always',
  };
}

/**
 * 当用户在 AI 角色会话中发送消息后，调用此函数生成 AI 回复
 */
export async function generateAiReply(conversationId: string, senderId: string, messageId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, nickname: true },
          },
        },
      },
    },
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

  // 获取全局配置
  const globalConfig = await getGlobalConfig();

  // 检查触发模式（手动重新生成 messageId 为空，跳过检查）
  if (messageId && globalConfig.aiTriggerMode !== 'always') {
    if (globalConfig.aiTriggerMode === 'mention') {
      // 仅 @提及触发
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { mentions: true, mentionsAll: true },
      });
      const isMentioned = message?.mentions?.includes(aiUser.id) || message?.mentionsAll;
      if (!isMentioned) return;
    } else if (globalConfig.aiTriggerMode === 'smart') {
      // 智能触发：完整决策链
      const decision = await smartTriggerDecision(role, aiUser.id, messageId, conversationId, senderId, globalConfig);
      if (!decision.shouldSpeak) return;

      // 如果决策是记录记忆但不发言，只记录不回复
      if (decision.action === 'record_memory' || decision.action === 'silence') return;

      // 如果决策是表情反应，发送简短表情
      if (decision.action === 'emoji') {
        // 表情反应暂不实现，走正常回复流程但限制长度
      }

      // 应用延迟（模拟思考时间）
      if (decision.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(decision.delayMs, 5000)));
      }
    }
  }
  // 'always' 模式或手动重新生成：总是回复

  // 获取最近消息作为上下文（使用可配置的条数）
  const contextLimit = globalConfig.contextMessageLimit || DEFAULT_CONTEXT_MESSAGE_LIMIT;
  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: contextLimit,
    include: {
      sender: {
        select: { id: true, nickname: true },
      },
    },
  });

  recentMessages.reverse();

  // 查找用户级 AI 参数覆盖
  const userConfig = await prisma.aiRoleUserConfig.findUnique({
    where: { roleId_userId: { roleId, userId: senderId } },
  });

  // 决定使用的模型：用户覆盖 > 角色配置 > 全局配置
  const effectiveModel = userConfig?.model ?? role.model;
  const effectiveReasoning = (userConfig?.useReasoning ?? role.useReasoning) && globalConfig.reasoningEnabled;
  const effectiveTemperature = userConfig?.temperature ?? role.temperature ?? globalConfig.temperature;
  const effectiveMaxTokens = userConfig?.maxTokens ?? role.maxTokens ?? globalConfig.maxTokens;

  const useModel = effectiveModel || globalConfig.chatModel;
  const useReasoning = effectiveReasoning;
  const finalModel = useReasoning ? (globalConfig.reasoningModel || useModel) : useModel;
  const temperature = effectiveTemperature;
  const maxTokens = effectiveMaxTokens;

  // 构建群成员列表（仅群昵称）
  const memberList = conversation.members
    .filter((m) => m.userId !== aiUser.id)
    .map((m) => m.nickname || m.user.nickname);

  // 构建 system prompt（包含群成员信息）
  const systemPrompt = buildSystemPrompt(role, memberList);
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // 如果开启私聊上下文参考，查找发送者与 AI 的私聊历史
  if (globalConfig.includePrivateContext) {
    const privateConv = await prisma.conversation.findFirst({
      where: {
        type: 'private',
        members: {
          every: { userId: { in: [senderId, aiUser.id] } },
        },
      },
    });

    if (privateConv) {
      const privateMessages = await prisma.message.findMany({
        where: { conversationId: privateConv.id },
        orderBy: { createdAt: 'desc' },
        take: PRIVATE_CONTEXT_MESSAGE_LIMIT,
        include: {
          sender: {
            select: { id: true, nickname: true },
          },
        },
      });
      privateMessages.reverse();

      if (privateMessages.length > 0) {
        llmMessages.push({
          role: 'system',
          content: `[以下是你与 ${privateMessages[0].sender.nickname} 的私聊记录，仅供参考]`,
        });
        for (const msg of privateMessages) {
          const isAi = msg.senderId === aiUser.id;
          llmMessages.push({
            role: isAi ? 'assistant' : 'user',
            content: isAi ? msg.content : `${msg.sender.nickname}: ${msg.content}`,
          });
        }
        llmMessages.push({
          role: 'system',
          content: '[私聊记录结束，以下是当前群聊上下文]',
        });
      }
    }
  }

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
    // 更新 AI 状态（冷却时间、连续计数）
    await updateAiState(conversationId, aiUser.id);
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
}, memberList?: string[]): string {
  const parts: string[] = [];

  parts.push(`你是${role.name}。`);

  if (role.systemPrompt) {
    parts.push(role.systemPrompt);
  }

  if (role.description) {
    parts.push(`角色描述：${role.description}`);
  }

  if (memberList && memberList.length > 0) {
    parts.push(`群成员：${memberList.join('、')}`);
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
 * 智能触发完整决策链
 * 流程：规则层1(信号提取) → LLM仲裁层(社交判断) → 规则层2(二次校验) → 状态更新
 */
async function smartTriggerDecision(
  role: { id: string; name: string; description: string | null; speakingStyle: string | null; forbiddenTopics: string | null },
  aiUserId: string,
  messageId: string,
  conversationId: string,
  senderId: string,
  config: ModelConfig,
): Promise<ArbitrationDecision> {
  const silentDecision: ArbitrationDecision = {
    shouldSpeak: false, action: 'silence', targetUser: '', tone: '', length: 'short', delayMs: 0, reason: '默认沉默',
  };

  try {
    // ===== 规则层1：快速信号提取 =====
    const signals = await extractSignals(aiUserId, messageId, conversationId, senderId);

    // 硬性禁止：直接沉默
    if (signals.hardProhibited) {
      return { ...silentDecision, reason: '硬性禁止发言' };
    }

    // @提及或回复AI：直接决定发言，跳过LLM仲裁
    if (signals.isMentioned || signals.isReplyToAi) {
      const decision: ArbitrationDecision = {
        shouldSpeak: true,
        action: 'reply',
        targetUser: signals.senderNickname,
        tone: '友好',
        length: signals.isQuestion ? 'medium' : 'short',
        delayMs: signals.isMentioned ? 500 : 1500,
        reason: signals.isMentioned ? '被@提及' : '被回复',
      };
      // 规则层2：即使被提及，也要检查连续发言限制
      return validateDecision(decision, signals);
    }

    // ===== LLM 仲裁层：社交判断 =====
    const arbitration = await llmArbitration(role, signals, config);

    // ===== 规则层2：二次校验 =====
    return validateDecision(arbitration, signals);
  } catch {
    return silentDecision;
  }
}

/**
 * 规则层1：快速信号提取
 * 纯代码逻辑，不调用LLM，毫秒级完成
 */
async function extractSignals(
  aiUserId: string,
  messageId: string,
  conversationId: string,
  senderId: string,
): Promise<SignalExtraction> {
  const { redis } = await import('../../config/redis');

  // 获取当前消息
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { content: true, mentions: true, mentionsAll: true },
  });
  const messageContent = message?.content || '';

  // 获取发送者昵称
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { nickname: true },
  });
  const senderNickname = sender?.nickname || '某人';

  // 1. 是否明确 @提及 AI
  const isMentioned = message?.mentions?.includes(aiUserId) || message?.mentionsAll || false;

  // 2. 是否回复 AI 的消息（检查最近一条消息是否是 AI 发的）
  const lastAiMessage = await prisma.message.findFirst({
    where: { conversationId, senderId: aiUserId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });
  // 检查当前消息是否是对 AI 消息的回复（通过消息内容中包含 AI 角色名或紧接 AI 消息后）
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    select: { senderId: true },
  });
  const isReplyToAi = lastMessage?.senderId === aiUserId && !isMentioned;

  // 3. 是否是问题（简单规则：包含问号或疑问词）
  const questionPatterns = /[？?]|怎么|什么|为什么|如何|哪|吗|呢|谁|几|多少|能不能|可以|会不会/;
  const isQuestion = questionPatterns.test(messageContent);

  // 4. 群聊速度（最近N秒内的消息数）
  const speedWindowStart = new Date(Date.now() - AI_CHAT_SPEED_WINDOW * 1000);
  const recentCount = await prisma.message.count({
    where: {
      conversationId,
      createdAt: { gte: speedWindowStart },
    },
  });
  const chatSpeed = Math.round((recentCount / AI_CHAT_SPEED_WINDOW) * 60);

  // 5. AI 是否刚说过话（冷却检查）
  const cooldownKey = `ai:cooldown:${conversationId}:${aiUserId}`;
  const lastReplyTs = await redis.get(cooldownKey);
  const aiJustSpoke = lastReplyTs ? (Date.now() - parseInt(lastReplyTs, 10)) < AI_COOLDOWN_SECONDS * 1000 : false;

  // 6. AI 连续回复次数
  const consecutiveKey = `ai:consecutive:${conversationId}:${aiUserId}`;
  const aiConsecutiveCount = parseInt(await redis.get(consecutiveKey) || '0', 10);

  // 7. 兴趣/记忆/情绪触发（关键词匹配）
  const interestPatterns = /记住|别忘了|上次|之前|你说过|你答应|约定|开心|难过|生气|害怕|惊喜|感动/;
  const interestTriggered = interestPatterns.test(messageContent);

  // 8. 硬性禁止发言
  const hardProhibited = aiConsecutiveCount >= AI_MAX_CONSECUTIVE;

  return {
    isMentioned,
    isReplyToAi,
    isQuestion,
    chatSpeed,
    aiJustSpoke,
    aiConsecutiveCount,
    interestTriggered,
    hardProhibited,
    messageContent,
    senderNickname,
  };
}

/**
 * LLM 仲裁层：社交判断
 * 输出结构化 JSON 决策
 */
async function llmArbitration(
  role: { id: string; name: string; description: string | null; speakingStyle: string | null; forbiddenTopics: string | null },
  signals: SignalExtraction,
  config: ModelConfig,
): Promise<ArbitrationDecision> {
  const silentDecision: ArbitrationDecision = {
    shouldSpeak: false, action: 'silence', targetUser: '', tone: '', length: 'short', delayMs: 0, reason: 'LLM仲裁默认沉默',
  };

  try {
    const prompt = `你是"${role.name}"，一个群聊中的AI角色。现在群里有人发了一条消息，你需要判断自己是否应该回复，以及如何回复。

角色描述：${role.description || '无'}
说话风格：${role.speakingStyle || '无'}

当前消息：
- 发送者：${signals.senderNickname}
- 内容："${signals.messageContent.slice(0, 300)}"

群聊状态信号：
- 是否是问题：${signals.isQuestion ? '是' : '否'}
- 群聊速度：${signals.chatSpeed}条/分钟（${signals.chatSpeed > AI_FAST_CHAT_THRESHOLD ? '快速' : '正常'}节奏）
- AI刚说过话：${signals.aiJustSpoke ? '是' : '否'}
- AI连续回复次数：${signals.aiConsecutiveCount}
- 触发兴趣/记忆/情绪：${signals.interestTriggered ? '是' : '否'}

请从以下角度判断：
1. 场景理解：群里在聊什么话题？
2. 关系判断：这句话跟我有没有关系？
3. 社交期待：别人是否期待我回应？
4. 自我动机：我有没有想参与的理由？
5. 贡献判断：我说了会不会让对话变好？
6. 打扰判断：我现在说话会不会突兀？

请严格按以下JSON格式回复，不要输出其他内容：
{"shouldSpeak":true/false,"action":"reply/interject/emoji/record_memory/silence","targetUser":"目标用户昵称","tone":"语气","length":"short/medium/long","delayMs":延迟毫秒数,"reason":"决策原因"}`;

    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const body = {
      model: config.chatModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return silentDecision;

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();

    // 解析 JSON（容错处理）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return silentDecision;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      shouldSpeak: !!parsed.shouldSpeak,
      action: ['reply', 'interject', 'emoji', 'record_memory', 'silence'].includes(parsed.action) ? parsed.action : 'silence',
      targetUser: parsed.targetUser || '',
      tone: parsed.tone || '友好',
      length: ['short', 'medium', 'long'].includes(parsed.length) ? parsed.length : 'short',
      delayMs: Math.min(Math.max(parseInt(parsed.delayMs, 10) || 0, 0), 5000),
      reason: parsed.reason || '',
    };
  } catch {
    // LLM 仲裁失败时默认沉默
    return silentDecision;
  }
}

/**
 * 规则层2：二次校验
 * 冷却、频率、风险检查
 */
function validateDecision(
  decision: ArbitrationDecision,
  signals: SignalExtraction,
): ArbitrationDecision {
  // 如果 LLM 说要发言，但 AI 刚说过话且不是被提及，增加延迟
  if (decision.shouldSpeak && signals.aiJustSpoke && !signals.isMentioned) {
    decision.delayMs = Math.max(decision.delayMs, 3000);
  }

  // 如果群聊节奏很快且 AI 不是被提及，降低发言欲望
  if (decision.shouldSpeak && signals.chatSpeed > AI_FAST_CHAT_THRESHOLD && !signals.isMentioned && !signals.isReplyToAi) {
    // 快节奏群聊中，非提及情况下更保守
    if (decision.action === 'interject') {
      return { ...decision, shouldSpeak: false, action: 'silence', reason: '群聊节奏过快，插话可能突兀' };
    }
  }

  // 如果 AI 连续发言接近上限，只允许简短回复
  if (decision.shouldSpeak && signals.aiConsecutiveCount >= AI_MAX_CONSECUTIVE - 1) {
    decision.length = 'short';
    decision.reason += '（接近连续发言上限，限制长度）';
  }

  return decision;
}

/**
 * 更新 AI 状态（冷却、连续计数）
 * 在 AI 成功回复后调用
 */
async function updateAiState(conversationId: string, aiUserId: string): Promise<void> {
  try {
    const { redis } = await import('../../config/redis');

    // 更新冷却时间戳
    const cooldownKey = `ai:cooldown:${conversationId}:${aiUserId}`;
    await redis.set(cooldownKey, String(Date.now()), { EX: AI_COOLDOWN_SECONDS * 3 });

    // 更新连续回复计数
    const consecutiveKey = `ai:consecutive:${conversationId}:${aiUserId}`;
    const current = parseInt(await redis.get(consecutiveKey) || '0', 10);
    await redis.set(consecutiveKey, String(current + 1), { EX: 300 }); // 5分钟过期

    // 检查最近几条消息，如果最后一条不是 AI 发的，重置连续计数
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { senderId: true },
    });
    // 如果倒数第二条（AI回复前）不是 AI 发的，说明 AI 不是连续发言
    if (recentMessages.length >= 2 && recentMessages[1].senderId !== aiUserId) {
      await redis.set(consecutiveKey, '1', { EX: 300 });
    }
  } catch {
    // 状态更新失败不影响主流程
  }
}

/**
 * 重置 AI 连续计数（当其他用户发言时调用）
 */
export async function resetAiConsecutiveCount(conversationId: string, aiUserId: string): Promise<void> {
  try {
    const { redis } = await import('../../config/redis');
    const consecutiveKey = `ai:consecutive:${conversationId}:${aiUserId}`;
    await redis.del(consecutiveKey);
  } catch {
    // 忽略
  }
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
