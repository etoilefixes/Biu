import { prisma } from '../../config/database';

export async function getConversations(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { nickname: true },
              },
            },
          },
        },
      },
    },
    orderBy: { conversation: { createdAt: 'desc' } },
  });

  const result = [];
  for (const m of memberships) {
    const conv = m.conversation;
    const lastMsg = conv.messages[0];

    const lastReadAt = await getLastReadAt(userId, conv.id);
    const afterTime = lastReadAt && lastReadAt > m.joinedAt ? lastReadAt : m.joinedAt;

    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        createdAt: { gt: afterTime },
      },
    });

    result.push({
      id: conv.id,
      type: conv.type,
      name: conv.name,
      creatorId: conv.creatorId,
      createdAt: conv.createdAt.toISOString(),
      members: conv.members.map((mem) => ({
        id: mem.id,
        conversationId: mem.conversationId,
        userId: mem.userId,
        joinedAt: mem.joinedAt.toISOString(),
        user: {
          ...mem.user,
          status: mem.user.status as 'online' | 'offline' | 'away',
          isSystem: mem.user.isSystem || false,
        },
      })),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            senderId: lastMsg.senderId,
            senderNickname: lastMsg.sender.nickname,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
      unreadCount,
    });
  }

  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.createdAt;
    const bTime = b.lastMessage?.createdAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return result;
}

async function getLastReadAt(userId: string, conversationId: string): Promise<Date | null> {
  const { redis } = await import('../../config/redis');
  const key = `read:${userId}:${conversationId}`;
  const data = await redis.get(key);
  return data ? new Date(data) : null;
}

export async function markAsRead(userId: string, conversationId: string) {
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (lastMessage) {
    const { redis } = await import('../../config/redis');
    const key = `read:${userId}:${conversationId}`;
    await redis.set(key, lastMessage.createdAt.toISOString());

    const unreadKey = `unread:${userId}:${conversationId}`;
    await redis.set(unreadKey, '0');
  }

  return { success: true };
}

export async function markAllAsRead(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const { redis } = await import('../../config/redis');

  for (const m of memberships) {
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: m.conversationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (lastMessage) {
      const key = `read:${userId}:${m.conversationId}`;
      await redis.set(key, lastMessage.createdAt.toISOString());

      const unreadKey = `unread:${userId}:${m.conversationId}`;
      await redis.set(unreadKey, '0');
    }
  }

  return { success: true };
}

export async function deleteConversation(userId: string, conversationId: string) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权操作此会话');
  }

  const systemMember = await prisma.conversationMember.findFirst({
    where: { conversationId, user: { isSystem: true } },
  });

  if (systemMember) {
    throw new Error('无法删除系统会话');
  }

  await prisma.conversationMember.deleteMany({
    where: { conversationId, userId },
  });

  const remaining = await prisma.conversationMember.count({
    where: { conversationId },
  });

  if (remaining === 0) {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });
  }

  const { redis } = await import('../../config/redis');
  const unreadKey = `unread:${userId}:${conversationId}`;
  await redis.del(unreadKey);
  const readKey = `read:${userId}:${conversationId}`;
  await redis.del(readKey);

  return { success: true };
}

export async function createConversation(
  userId: string,
  data: { type: 'private' | 'group'; name?: string; memberIds: string[] }
) {
  if (data.type === 'private') {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'private',
        members: {
          every: { userId: { in: [userId, ...data.memberIds] } },
        },
      },
      include: {
        members: true,
      },
    });

    if (existing && existing.members.length === data.memberIds.length + 1) {
      return getConversationDetail(existing.id, userId);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: data.type,
      name: data.name || null,
      creatorId: userId,
      members: {
        create: [
          { userId },
          ...data.memberIds.map((memberId) => ({ userId: memberId })),
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true },
          },
        },
      },
    },
  });

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
        isSystem: m.user.isSystem || false,
      },
    })),
  };
}

export async function getConversationDetail(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权访问此会话');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('会话不存在');
  }

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
        isSystem: m.user.isSystem || false,
      },
    })),
  };
}
