import { prisma } from '../../config/database';

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
    include: { sender: true },
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
