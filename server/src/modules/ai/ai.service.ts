import { prisma } from '../../config/database';
import { generateConversationBiuId } from '../../utils/biuId';

export async function quickSendMessage(userId: string, targetUserId: string, content: string) {
  // 入参校验：防止绕过好友系统向任意非好友发消息
  // 1. 不能给自己发消息
  if (userId === targetUserId) {
    throw new Error('不能给自己发消息');
  }

  // 2. 目标用户必须存在
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isSystem: true },
  });
  if (!targetUser) {
    throw new Error('目标用户不存在');
  }

  // 3. 双方必须是好友（系统用户除外，允许向系统用户发消息）
  if (!targetUser.isSystem) {
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: targetUserId, status: 'accepted' },
          { fromUserId: targetUserId, toUserId: userId, status: 'accepted' },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw new Error('只能向好友发送消息，请先添加好友');
    }
  }

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
