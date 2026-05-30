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
          },
        },
      },
    },
    orderBy: { conversation: { createdAt: 'desc' } },
  });

  return memberships.map((m) => ({
    id: m.conversation.id,
    type: m.conversation.type,
    name: m.conversation.name,
    creatorId: m.conversation.creatorId,
    createdAt: m.conversation.createdAt.toISOString(),
    members: m.conversation.members.map((mem) => ({
      id: mem.id,
      conversationId: mem.conversationId,
      userId: mem.userId,
      joinedAt: mem.joinedAt.toISOString(),
      user: {
        ...mem.user,
        status: mem.user.status as 'online' | 'offline' | 'away',
      },
    })),
    lastMessage: m.conversation.messages[0]
      ? {
          id: m.conversation.messages[0].id,
          content: m.conversation.messages[0].content,
          senderId: m.conversation.messages[0].senderId,
          createdAt: m.conversation.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
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
