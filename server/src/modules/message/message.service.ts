import { prisma } from '../../config/database';

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

  const where: any = { conversationId };
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return messages
    .reverse()
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      type: m.type as 'text' | 'image' | 'file' | 'card',
      cardType: m.cardType,
      cardData: m.cardData ? JSON.parse(m.cardData) : null,
      createdAt: m.createdAt.toISOString(),
      sender: {
        ...m.sender,
        status: m.sender.status as 'online' | 'offline' | 'away',
        isSystem: m.sender.isSystem || false,
      },
    }));
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

  if (!membership) {
    throw new Error('无权在此会话发送消息');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type,
      cardType: cardType || null,
      cardData: cardData ? JSON.stringify(cardData) : null,
    },
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true },
      },
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: message.type as 'text' | 'image' | 'file' | 'card',
    cardType: message.cardType,
    cardData: message.cardData ? JSON.parse(message.cardData) : null,
    createdAt: message.createdAt.toISOString(),
    sender: {
      ...message.sender,
      status: message.sender.status as 'online' | 'offline' | 'away',
      isSystem: message.sender.isSystem || false,
    },
  };
}
