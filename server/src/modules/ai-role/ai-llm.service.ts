import { prisma } from '../../config/database';
import { getIo } from '../../socket';

const CONTEXT_MESSAGE_LIMIT = 20;

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 当用户在 AI 角色会话中发送消息后，调用此函数生成 AI 回复
 */
export async function generateAiReply(conversationId: string, senderId: string) {
  // 检查该会话是否是 AI 角色会话
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || !conversation.name?.startsWith('__ai_role__')) {
    return; // 不是 AI 角色会话，跳过
  }

  const roleId = conversation.name.replace('__ai_role__', '');

  const role = await prisma.aiRole.findUnique({ where: { id: roleId } });
  if (!role) return;

  // 获取 AI 角色对应的虚拟用户 ID
  const aiUsername = `ai_role_${roleId.replace(/-/g, '_')}`;
  const aiUser = await prisma.user.findUnique({ where: { username: aiUsername } });
  if (!aiUser) return;

  // 不要回复自己发的消息
  if (senderId === aiUser.id) return;

  // 获取最近 20 条消息作为上下文
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

  // 构建 LLM 消息
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
    const reply = await callLLM(llmMessages, role.temperature, role.replyLength);

    // 保存 AI 回复到数据库
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

    // 通过 WebSocket 推送给会话成员
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
  personality: string | null;
  speakingStyle: string | null;
  forbiddenTopics: string | null;
  replyLength: string;
}): string {
  const parts: string[] = [];

  parts.push(`你是${role.name}。`);

  if (role.description) {
    parts.push(`角色描述：${role.description}`);
  }

  if (role.personality) {
    parts.push(`人设/性格：${role.personality}`);
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

async function callLLM(
  messages: LLMMessage[],
  temperature: number = 0.7,
  _replyLength: string = 'medium'
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const apiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.LLM_MODEL || 'gpt-3.5-turbo';

  if (!apiKey) {
    // 没有配置 API Key 时返回默认回复
    return '（AI 服务未配置，请联系管理员设置 LLM_API_KEY）';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM] API error:', response.status, errorText);
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '（AI 暂时无法回复）';
}
