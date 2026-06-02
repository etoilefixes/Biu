import { prisma } from '../../config/database';

// 生成2开头的六位数BiuId
function generateGroupBiuId(): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `2${randomNum.toString().slice(1)}`;
}

export async function getConversations(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
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

    // Check mention status
    const conversationRead = await prisma.conversationRead.findFirst({
      where: {
        conversationId: conv.id,
        userId,
      },
    });

    result.push({
      id: conv.id,
      biuId: conv.biuId,
      type: conv.type,
      name: conv.name,
      creatorId: conv.creatorId,
      ownerId: conv.ownerId,
      announcement: conv.announcement,
      createdAt: conv.createdAt.toISOString(),
      members: conv.members.map((mem) => ({
        id: mem.id,
        conversationId: mem.conversationId,
        userId: mem.userId,
        nickname: mem.nickname,
        joinedAt: mem.joinedAt.toISOString(),
        user: {
          ...mem.user,
          status: mem.user.status as 'online' | 'offline' | 'away',
          isSystem: mem.user.isSystem || false,
          badges: mem.user.badges.map((ub: any) => ({
            type: ub.badge.type,
            label: ub.badge.label,
            icon: ub.badge.icon,
            color: ub.badge.color,
          })),
        },
      })),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            senderId: lastMsg.senderId,
            senderNickname: lastMsg.sender.nickname,
            createdAt: lastMsg.createdAt.toISOString(),
            mentions: lastMsg.mentions ? JSON.parse(lastMsg.mentions) : null,
            mentionsAll: lastMsg.mentionsAll,
          }
        : null,
      unreadCount,
      mentionType: conversationRead 
        ? conversationRead.mentionedAll 
          ? 'all' 
          : conversationRead.mentioned 
            ? 'me' 
            : null 
        : null,
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
    
    // Clear mention status
    await prisma.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        mentioned: false,
        mentionedAll: false,
      },
      update: {
        mentioned: false,
        mentionedAll: false,
      },
    });
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
      
      // Clear mention status
      await prisma.conversationRead.upsert({
        where: {
          conversationId_userId: {
            conversationId: m.conversationId,
            userId,
          },
        },
        create: {
          conversationId: m.conversationId,
          userId,
          mentioned: false,
          mentionedAll: false,
        },
        update: {
          mentioned: false,
          mentionedAll: false,
        },
      });
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

  let biuId = undefined;
  if (data.type === 'group') {
    biuId = generateGroupBiuId();
    let exists = await prisma.conversation.findUnique({ where: { biuId } });
    while (exists) {
      biuId = generateGroupBiuId();
      exists = await prisma.conversation.findUnique({ where: { biuId } });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: data.type,
      name: data.name || null,
      creatorId: userId,
      ownerId: userId,
      biuId: biuId || crypto.randomUUID(),
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
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
          },
        },
      },
    },
  });

  return {
    id: conversation.id,
    biuId: conversation.biuId,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    ownerId: conversation.ownerId,
    announcement: conversation.announcement,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      nickname: m.nickname,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
        isSystem: m.user.isSystem || false,
        badges: m.user.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    })),
  };
}

export async function updateGroupName(
  userId: string,
  conversationId: string,
  name: string
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation?.type !== 'group') throw new Error('只能修改群聊名称');
  if (conversation.ownerId !== userId) throw new Error('只有群主可以修改群名称');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { name },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
          },
        },
      },
    },
  });

  return formatConversation(updated, userId);
}

export async function updateMemberNickname(
  userId: string,
  conversationId: string,
  nickname: string
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const updatedMember = await prisma.conversationMember.update({
    where: { id: membership.id },
    data: { nickname },
    include: {
      user: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
      },
    },
  });

  return {
    id: updatedMember.id,
    conversationId: updatedMember.conversationId,
    userId: updatedMember.userId,
    nickname: updatedMember.nickname,
    joinedAt: updatedMember.joinedAt.toISOString(),
    user: {
      ...updatedMember.user,
      status: updatedMember.user.status as 'online' | 'offline' | 'away',
      isSystem: updatedMember.user.isSystem || false,
      badges: updatedMember.user.badges.map((ub: any) => ({
        type: ub.badge.type,
        label: ub.badge.label,
        icon: ub.badge.icon,
        color: ub.badge.color,
      })),
    },
  };
}

export async function setAnnouncement(
  userId: string,
  conversationId: string,
  announcement: string | null
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation?.type !== 'group') throw new Error('只能设置群聊公告');
  if (conversation.ownerId !== userId) throw new Error('只有群主可以设置公告');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { announcement },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
          },
        },
      },
    },
  });

  return formatConversation(updated, userId);
}

export async function removeMember(
  userId: string,
  conversationId: string,
  memberId: string
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation?.type !== 'group') throw new Error('只能在群聊中移除成员');
  if (conversation.ownerId !== userId) throw new Error('只有群主可以移除成员');

  const memberToRemove = await prisma.conversationMember.findFirst({
    where: { id: memberId, conversationId },
  });

  if (!memberToRemove) throw new Error('成员不存在');

  await prisma.conversationMember.delete({
    where: { id: memberId },
  });

  return { success: true };
}

export async function leaveGroup(
  userId: string,
  conversationId: string
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { _count: { select: { members: true } } },
  });

  if (conversation?.type !== 'group') throw new Error('只能退出群聊');

  // 如果只剩一个人，直接删除整个群
  if (conversation._count.members <= 1) {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversationMember.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });
    return { success: true, deleted: true };
  }

  // 如果是群主，需要转移群主权限
  if (conversation.ownerId === userId) {
    const newOwner = await prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
    });
    if (newOwner) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { ownerId: newOwner.userId },
      });
    }
  }

  await prisma.conversationMember.delete({
    where: { id: membership.id },
  });

  return { success: true, deleted: false };
}

export async function dissolveGroup(
  userId: string,
  conversationId: string
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!membership) throw new Error('无权操作此会话');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation?.type !== 'group') throw new Error('只能解散群聊');
  if (conversation.ownerId !== userId) throw new Error('只有群主可以解散群聊');

  await prisma.message.deleteMany({ where: { conversationId } });
  await prisma.conversationMember.deleteMany({ where: { conversationId } });
  await prisma.conversation.delete({ where: { id: conversationId } });

  return { success: true };
}

// 辅助函数：格式化会话数据
function formatConversation(conversation: any, currentUserId: string) {
  return {
    id: conversation.id,
    biuId: conversation.biuId,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    ownerId: conversation.ownerId,
    announcement: conversation.announcement,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      nickname: m.nickname,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
        isSystem: m.user.isSystem || false,
        badges: m.user.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    })),
  };
}

export async function addMemberToConversation(userId: string, conversationId: string, memberUserId: string) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权操作此会话');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('会话不存在');
  }

  if (conversation.type !== 'group') {
    throw new Error('只能在群聊中添加成员');
  }

  const existingMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: memberUserId },
  });

  if (existingMember) {
    throw new Error('该用户已在群聊中');
  }

  const user = await prisma.user.findUnique({
    where: { id: memberUserId },
    select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  const newMember = await prisma.conversationMember.create({
    data: {
      conversationId,
      userId: memberUserId,
    },
    include: { user: true },
  });

  return {
    id: newMember.id,
    conversationId: newMember.conversationId,
    userId: newMember.userId,
    joinedAt: newMember.joinedAt.toISOString(),
    user: {
      ...user,
      status: user.status as 'online' | 'offline' | 'away',
      isSystem: user.isSystem || false,
      badges: user.badges.map((ub: any) => ({
        type: ub.badge.type,
        label: ub.badge.label,
        icon: ub.badge.icon,
        color: ub.badge.color,
      })),
    },
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
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
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
        badges: m.user.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    })),
  };
}
