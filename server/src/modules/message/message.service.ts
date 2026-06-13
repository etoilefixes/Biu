import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { canSendMessage } from '../auth/permissions';

function parseMentions(content: string) {
  const mentions: string[] = [];
  const mentionPattern = /\[at:([^\]]+)\]/g;
  let match;
  
  while ((match = mentionPattern.exec(content)) !== null) {
    // 排除 [at:all]，它由 mentionsAll 单独处理
    if (match[1] !== 'all') {
      mentions.push(match[1]);
    }
  }
  
  return mentions;
}

export async function getMessages(
  conversationId: string,
  userId: string,
  before?: string,
  limit: number = 50
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权访问此会话');
  }

  // Fetch lastReadAt BEFORE markAsRead updates it — this is the anchor
  const readKey = `read:${userId}:${conversationId}`;
  const lastReadAtStr = await redis.get(readKey);
  const lastReadAt = lastReadAtStr || null;

  const where: any = { conversationId };
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const formatted = messages
    .reverse()
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      type: m.type as 'text' | 'image' | 'file' | 'card' | 'system',
      cardType: m.cardType,
      cardData: m.cardData ? JSON.parse(m.cardData) : null,
      mentions: m.mentions ? JSON.parse(m.mentions) : null,
      mentionsAll: m.mentionsAll,
      createdAt: m.createdAt.toISOString(),
      sender: {
        ...m.sender,
        status: m.sender.status as 'online' | 'offline' | 'away',
        isSystem: m.sender.isSystem || false,
        badges: m.sender.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    }));

  return { messages: formatted, lastReadAt };
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: string = 'text',
  cardType?: string | null,
  cardData?: any
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: senderId },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || !canSendMessage(conversation, membership)) {
    throw new Error('无权在此会话发送消息');
  }

  const mentions = parseMentions(content);
  const mentionsAll = content.includes('[at:all]');
  
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type,
      cardType: cardType || null,
      cardData: cardData ? JSON.stringify(cardData) : null,
      mentions: mentions.length > 0 ? JSON.stringify(mentions) : null,
      mentionsAll,
    },
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
      },
    },
  });

  // Update conversation reads for mentioned users
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
  });

  for (const member of members) {
    if (member.userId === senderId) continue;
    
    const wasMentioned = mentions.includes(member.userId) || mentionsAll;
    
    await prisma.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: member.userId,
        },
      },
      create: {
        conversationId,
        userId: member.userId,
        mentioned: wasMentioned,
        mentionedAll: mentionsAll && wasMentioned,
      },
      update: {
        mentioned: wasMentioned,
        mentionedAll: mentionsAll,
      },
    });
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: message.type as 'text' | 'image' | 'file' | 'card' | 'system',
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
}

/**
 * 创建系统消息（跳过权限检查，不触发未读计数）
 * 系统消息的 senderId 使用系统用户，cardType 为 action 名，cardData 包含操作详情
 */
export async function createSystemMessage(
  conversationId: string,
  cardType: string,
  cardData: Record<string, any>,
  content?: string
) {
  // 查找系统用户作为 sender
  const systemUser = await prisma.user.findFirst({
    where: { isSystem: true },
  });
  if (!systemUser) {
    console.warn('System user not found, skipping system message');
    return null;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: systemUser.id,
      content: content || '',
      type: 'system',
      cardType,
      cardData: JSON.stringify(cardData),
      mentions: null,
      mentionsAll: false,
    },
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
      },
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: 'system' as const,
    cardType: message.cardType,
    cardData: message.cardData ? JSON.parse(message.cardData) : null,
    mentions: null,
    mentionsAll: false,
    createdAt: message.createdAt.toISOString(),
    sender: {
      ...message.sender,
      status: message.sender.status as 'online' | 'offline' | 'away',
      isSystem: true,
      badges: message.sender.badges.map((ub: any) => ({
        type: ub.badge.type,
        label: ub.badge.label,
        icon: ub.badge.icon,
        color: ub.badge.color,
      })),
    },
  };
}
