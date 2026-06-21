import { prisma } from '../../config/database';
import { generateConversationBiuId } from '../../utils/biuId';

export async function quickSendMessage(userId: string, targetUserId: string, content: string) {
  let conversation = await prisma.conversation.findFirst({
    where: {
      type: 'private',
      members: {
        every: {
          userId: { in: [userId, targetUserId] },
        },
      },
    },
    include: { members: true },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        biuId: generateConversationBiuId(),
        type: 'private',
        creatorId: userId,
        ownerId: userId,
        members: {
          create: [
            { userId },
            { userId: targetUserId },
          ],
        },
      },
      include: { members: true },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userId,
      content,
      type: 'text',
    },
    // 仅选择安全字段，排除 passwordHash（原 include: { sender: true } 返回完整 User）
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          status: true,
          isSystem: true,
        },
      },
    },
  });

  return message;
}

export async function getRecentConversations(userId: string, limit = 10) {
  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      members: { include: { user: true } },
      messages: { take: 1, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return conversations;
}

export async function findUserByBiuId(biuId: string) {
  const user = await prisma.user.findUnique({
    where: { biuId },
    select: { id: true, username: true, nickname: true, biuId: true, badges: { include: { badge: true } } },
  });
  return user;
}
