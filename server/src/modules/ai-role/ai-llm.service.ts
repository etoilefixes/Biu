import { prisma } from '../../config/database';
import { getIo } from '../../socket';
import { redis } from '../../config/redis';
import { ReasoningStreamParser, AiStreamChunk } from './reasoning-parser';
import { resolveAiModelForPurpose, getFullConfig, ResolvedAiModel } from './ai-model-resolver';

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

/** 行为配置（不含模型连接信息，模型信息通过 resolveAiModelForPurpose 获取） */
interface BehaviorConfig {
  reasoningEnabled: boolean;
  reasoningMode: string;
  reasoningDisplay: string;
  reasoningEffort: string;
  streamingEnabled: boolean;
  contextMessageLimit: number;
  arbitrationMaxTokens: number;
  includePrivateContext: boolean;
  aiTriggerMode: string;
}

/**
 * 获取全局行为配置
 * 模型连接信息通过 resolveAiModelForPurpose 获取
 */
async function getBehaviorConfig(): Promise<BehaviorConfig> {
  const fullConfig = await getFullConfig();

  if (fullConfig) {
    return {
      reasoningEnabled: fullConfig.reasoningEnabled,
      reasoningMode: fullConfig.reasoningMode || 'none',
      reasoningDisplay: fullConfig.reasoningDisplay || 'hidden',
      reasoningEffort: fullConfig.reasoningEffort || 'high',
      streamingEnabled: fullConfig.streamingEnabled,
      contextMessageLimit: fullConfig.contextMessageLimit ?? DEFAULT_CONTEXT_MESSAGE_LIMIT,
      arbitrationMaxTokens: fullConfig.arbitrationMaxTokens ?? 200,
      includePrivateContext: fullConfig.includePrivateContext ?? false,
      aiTriggerMode: fullConfig.aiTriggerMode || 'always',
    };
  }

  // Fallback 到环境变量
  return {
    reasoningEnabled: process.env.AI_REASONING_ENABLED === 'true',
    reasoningMode: process.env.AI_REASONING_MODE || 'none',
    reasoningDisplay: process.env.AI_REASONING_DISPLAY || 'hidden',
    reasoningEffort: process.env.AI_REASONING_EFFORT || 'high',
    streamingEnabled: process.env.AI_STREAMING !== 'false',
    contextMessageLimit: DEFAULT_CONTEXT_MESSAGE_LIMIT,
    arbitrationMaxTokens: 200,
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

  // 获取行为配置
  const behaviorConfig = await getBehaviorConfig();

  // 检查触发模式（手动重新生成 messageId 为空，跳过检查）
  // 私聊场景下始终回复（对方一定是在跟 AI 说话）
  if (messageId && behaviorConfig.aiTriggerMode !== 'always' && conversation.type === 'group') {
    if (behaviorConfig.aiTriggerMode === 'mention') {
      // 仅 @提及触发
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { mentions: true, mentionsAll: true },
      });
      const isMentioned = message?.mentions?.includes(aiUser.id) || message?.mentionsAll;
      if (!isMentioned) return;
    } else if (behaviorConfig.aiTriggerMode === 'smart') {
      // 智能触发：完整决策链
      const decision = await smartTriggerDecision(role, aiUser.id, messageId, conversationId, senderId, behaviorConfig);
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

  // 获取最近消息作为上下文（0=无限）
  const contextLimit = behaviorConfig.contextMessageLimit || DEFAULT_CONTEXT_MESSAGE_LIMIT;

  // 检查上下文断点：AI 只看断点之后的消息
  const cutoffTime = await redis.get(`ai:context_cutoff:${conversationId}`);

  const recentMessages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cutoffTime ? { createdAt: { gt: new Date(cutoffTime) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    ...(contextLimit > 0 ? { take: contextLimit } : {}),
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

  // 解析模型：聊天和推理用途
  const chatModel = await resolveAiModelForPurpose('chat');
  const reasoningModel = await resolveAiModelForPurpose('reasoning');

  // 决定是否使用推理：用户覆盖 > 角色配置 > 全局配置
  const effectiveReasoning = (userConfig?.useReasoning ?? role.useReasoning) && behaviorConfig.reasoningEnabled;
  const useReasoning = effectiveReasoning;

  // 用户/角色级可覆盖 temperature 和 maxTokens
  const temperature = userConfig?.temperature ?? role.temperature ?? chatModel.temperature;
  const maxTokens = userConfig?.maxTokens ?? role.maxTokens ?? chatModel.maxTokens;

  // 推理模式下使用推理模型
  const resolvedModel = useReasoning ? reasoningModel : chatModel;

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
  if (behaviorConfig.includePrivateContext) {
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
    if (behaviorConfig.streamingEnabled) {
      await streamLLMAndReply(resolvedModel, llmMessages, temperature, maxTokens, conversationId, aiUser.id, useReasoning, behaviorConfig);
    } else {
      await nonStreamLLMAndReply(resolvedModel, llmMessages, temperature, maxTokens, conversationId, aiUser.id, useReasoning, behaviorConfig);
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
  model: ResolvedAiModel,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  conversationId: string,
  aiUserId: string,
  useReasoning: boolean,
  behaviorConfig: BehaviorConfig,
) {
  if (!model.apiKey && model.provider !== 'ollama') {
    await emitErrorAndSaveFallback(conversationId, aiUserId, 'AI 服务未配置，请联系管理员设置 API Key');
    return;
  }

  const url = `${model.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`;
  }

  const body: any = {
    model: model.modelName,
    messages,
    temperature,
    max_tokens: Math.min(maxTokens, 393216),
    stream: true,
  };

  // DeepSeek V4 thinking 参数适配
  if (useReasoning) {
    if (model.provider === 'deepseek' || model.provider === 'openai-compatible') {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = behaviorConfig.reasoningEffort || 'high';
    }
  }

  const reasoningMode = useReasoning ? behaviorConfig.reasoningMode : 'none';
  const parser = new ReasoningStreamParser(reasoningMode);

  const io = getIo();

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
              if (behaviorConfig.reasoningDisplay !== 'hidden') {
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
  await saveAndBroadcastMessage(conversationId, aiUserId, finalContent, reasoningBuffer, behaviorConfig.reasoningDisplay);
}

/**
 * 非流式调用 LLM（fallback）
 */
async function nonStreamLLMAndReply(
  model: ResolvedAiModel,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  conversationId: string,
  aiUserId: string,
  useReasoning: boolean,
  behaviorConfig: BehaviorConfig,
) {
  const reply = await callLLM(model, messages, temperature, maxTokens, useReasoning, behaviorConfig);
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
  // 思考内容单独存储在 cardData 中，不附加到 content
  const finalContent = content;

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
  behaviorConfig: BehaviorConfig,
): Promise<ArbitrationDecision> {
  const silentDecision: ArbitrationDecision = {
    shouldSpeak: false, action: 'silence', targetUser: '', tone: '', length: 'short', delayMs: 0, reason: '默认沉默',
  };

  try {
    // ===== 规则层1：快速信号提取 =====
    const signals = await extractSignals(aiUserId, messageId, conversationId, senderId);
    console.log(`[SmartTrigger] 信号提取: mentioned=${signals.isMentioned}, replyToAi=${signals.isReplyToAi}, question=${signals.isQuestion}, speed=${signals.chatSpeed}, justSpoke=${signals.aiJustSpoke}, consecutive=${signals.aiConsecutiveCount}, interest=${signals.interestTriggered}, prohibited=${signals.hardProhibited}`);

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
    const arbitration = await llmArbitration(role, signals, conversationId, aiUserId, behaviorConfig.arbitrationMaxTokens, behaviorConfig.contextMessageLimit);
    console.log(`[SmartTrigger] LLM仲裁: shouldSpeak=${arbitration.shouldSpeak}, action=${arbitration.action}, tone=${arbitration.tone}, length=${arbitration.length}, delay=${arbitration.delayMs}ms, reason=${arbitration.reason}`);

    // ===== 规则层2：二次校验 =====
    const validated = validateDecision(arbitration, signals);
    console.log(`[SmartTrigger] 最终决策: shouldSpeak=${validated.shouldSpeak}, action=${validated.action}, delay=${validated.delayMs}ms`);
    return validated;
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

  // 2. 是否回复 AI 的消息（当前消息的上一条是否是 AI 发的）
  const messageBeforeCurrent = await prisma.message.findFirst({
    where: {
      conversationId,
      createdAt: { lt: new Date() },
      id: { not: messageId },
    },
    orderBy: { createdAt: 'desc' },
    select: { senderId: true },
  });
  const isReplyToAi = messageBeforeCurrent?.senderId === aiUserId && !isMentioned;

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
 * 压缩聊天上下文：将最近消息压缩为简洁摘要，供仲裁模型使用
 * 条数与聊天模型相同（0=无限），每条消息截断到 80 字符，不限制总长度
 */
async function compressChatContext(
  conversationId: string,
  aiUserId: string,
  contextMessageLimit: number,
): Promise<string> {
  const limit = contextMessageLimit || DEFAULT_CONTEXT_MESSAGE_LIMIT;

  // 检查上下文断点：AI 只看断点之后的消息
  const cutoffTime = await redis.get(`ai:context_cutoff:${conversationId}`);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cutoffTime ? { createdAt: { gt: new Date(cutoffTime) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    ...(limit > 0 ? { take: limit } : {}),
    include: {
      sender: { select: { id: true, nickname: true } },
    },
  });

  if (messages.length === 0) return '（无聊天记录）';

  messages.reverse();

  const lines: string[] = [];

  for (const msg of messages) {
    const isAi = msg.senderId === aiUserId;
    const name = isAi ? 'AI' : msg.sender.nickname;
    // 每条消息截断到 80 字符
    const content = msg.content.length > 80 ? msg.content.slice(0, 77) + '...' : msg.content;
    lines.push(`${name}: ${content}`);
  }

  return lines.join('\n');
}

/**
 * LLM 仲裁层：社交判断
 * 输出结构化 JSON 决策
 * 使用仲裁专用模型（resolveAiModelForPurpose('arbitration')）
 */
async function llmArbitration(
  role: { id: string; name: string; description: string | null; speakingStyle: string | null; forbiddenTopics: string | null },
  signals: SignalExtraction,
  conversationId: string,
  aiUserId: string,
  arbitrationMaxTokens: number,
  contextMessageLimit: number,
): Promise<ArbitrationDecision> {
  const silentDecision: ArbitrationDecision = {
    shouldSpeak: false, action: 'silence', targetUser: '', tone: '', length: 'short', delayMs: 0, reason: 'LLM仲裁默认沉默',
  };

  try {
    // 获取压缩后的聊天上下文
    const chatContext = await compressChatContext(conversationId, aiUserId, contextMessageLimit);

    const prompt = `你是群聊AI角色"${role.name}"，判断是否应该回复当前消息。
${role.description ? `角色：${role.description}` : ''}${role.speakingStyle ? ` 风格：${role.speakingStyle}` : ''}

聊天记录：
${chatContext}

当前消息：${signals.senderNickname}："${signals.messageContent.slice(0, 200)}"
信号：${signals.isQuestion ? '问题 ' : ''}${signals.aiJustSpoke ? 'AI刚发言 ' : ''}连续${signals.aiConsecutiveCount}次 ${signals.interestTriggered ? '触发兴趣' : ''} 速度${signals.chatSpeed}条/分

判断：1.跟我有关？2.别人期待我回？3.我回会让对话更好？4.现在说突兀吗？

严格JSON回复：{"shouldSpeak":bool,"action":"reply/interject/emoji/record_memory/silence","targetUser":"昵称","tone":"语气","length":"short/medium/long","delayMs":毫秒,"reason":"原因"}`;

    // 使用仲裁专用模型
    const arbModel = await resolveAiModelForPurpose('arbitration');

    const url = `${arbModel.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (arbModel.apiKey) {
      headers['Authorization'] = `Bearer ${arbModel.apiKey}`;
    }

    const body = {
      model: arbModel.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: arbitrationMaxTokens,
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
  let result = { ...decision };

  // 如果 LLM 说要发言，但 AI 刚说过话且不是被提及，增加延迟
  if (result.shouldSpeak && signals.aiJustSpoke && !signals.isMentioned) {
    result.delayMs = Math.max(result.delayMs, 3000);
  }

  // 如果群聊节奏很快且 AI 不是被提及，降低发言欲望
  if (result.shouldSpeak && signals.chatSpeed > AI_FAST_CHAT_THRESHOLD && !signals.isMentioned && !signals.isReplyToAi) {
    // 快节奏群聊中，非提及情况下更保守
    if (result.action === 'interject') {
      return { ...result, shouldSpeak: false, action: 'silence', reason: '群聊节奏过快，插话可能突兀' };
    }
  }

  // 如果 AI 连续发言接近上限，只允许简短回复
  if (result.shouldSpeak && signals.aiConsecutiveCount >= AI_MAX_CONSECUTIVE - 1) {
    result.length = 'short';
    result.reason += '（接近连续发言上限，限制长度）';
  }

  return result;
}

/**
 * 更新 AI 状态（冷却、连续计数）
 * 在 AI 成功回复后调用
 */
async function updateAiState(conversationId: string, aiUserId: string): Promise<void> {
  try {
  

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
  model: ResolvedAiModel,
  messages: LLMMessage[],
  temperature: number = 0.7,
  maxTokens: number = 2000,
  useReasoning: boolean = false,
  behaviorConfig?: BehaviorConfig,
): Promise<string> {
  if (!model.apiKey && model.provider !== 'ollama') {
    return '（AI 服务未配置，请联系管理员设置 API Key）';
  }

  const url = `${model.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`;
  }

  const body: any = {
    model: model.modelName,
    messages,
    temperature,
    max_tokens: Math.min(maxTokens, 393216),
  };

  // DeepSeek V4 thinking 参数适配
  if (useReasoning) {
    if (model.provider === 'deepseek' || model.provider === 'openai-compatible') {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = behaviorConfig?.reasoningEffort || 'high';
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
  if (useReasoning && behaviorConfig?.reasoningMode === 'think-tag') {
    const thinkTagRegex = /<think[^>]*>([\s\S]*?)<\/think>/g;
    const cleaned = mainContent.replace(thinkTagRegex, '').trim();
    return cleaned || mainContent;
  }

  return mainContent;
}

/**
 * 测试 AI 连接
 */
export async function testConnection(config: { baseUrl?: string; apiKey?: string; provider?: string }): Promise<{ success: boolean; message: string; models?: string[] }> {
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
