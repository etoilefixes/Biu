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
                select: { id: true, username: true, nickname: true, avatar: true, status: true },
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

    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        createdAt: { gt: m.joinedAt },
        NOT: {
          id: {
            in: await getReadMessageIds(userId, conv.id),
          },
        },
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

  return result;
}

async function getReadMessageIds(userId: string, conversationId: string): Promise<string[]> {
  const key = `read:${userId}:${conversationId}`;
  const data = await import('../../config/redis').then((m) => m.redis.get(key));
  return data ? JSON.parse(data) : [];
}

export async function markAsRead(userId: string, conversationId: string) {
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (lastMessage) {
    const { redis } = await import('../../config/redis');
    const key = `read:${userId}:${conversationId}`;
    await redis.set(key, JSON.stringify([lastMessage.id]));

    const unreadKey = `unread:${userId}:${conversationId}`;
    await redis.set(unreadKey, '0');
  }

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
            select: { id: true, username: true, nickname: true, avatar: true, status: true },
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
            select: { id: true, username: true, nickname: true, avatar: true, status: true },
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
      },
    })),
  };
}
