import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { getIo } from '../../socket';

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  message?: string
) {
  if (fromUserId === toUserId) {
    throw new Error('不能添加自己为好友');
  }

  const targetUser = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!targetUser) {
    throw new Error('用户不存在');
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId, toUserId, status: 'pending' },
        { fromUserId: toUserId, toUserId: fromUserId, status: 'pending' },
      ],
    },
  });
  if (existing) {
    throw new Error('已存在待处理的好友请求');
  }

  const existingAccepted = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId, toUserId, status: 'accepted' },
        { fromUserId: toUserId, toUserId: fromUserId, status: 'accepted' },
      ],
    },
  });
  if (existingAccepted) {
    throw new Error('已经是好友了');
  }

  const request = await prisma.friendRequest.create({
    data: { fromUserId, toUserId, message: message || null },
    include: {
      fromUser: { select: { id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } } },
      toUser: { select: { id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } } },
    },
  });

  const mapBadges = (badges: any[]) => badges.map((ub: any) => ({
    type: ub.badge.type,
    label: ub.badge.label,
    icon: ub.badge.icon,
    color: ub.badge.color,
  }));

  const result = {
    id: request.id,
    fromUserId: request.fromUserId,
    toUserId: request.toUserId,
    status: request.status,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
    fromUser: { ...request.fromUser, status: request.fromUser.status as 'online' | 'offline' | 'away', isSystem: request.fromUser.isSystem || false, badges: mapBadges(request.fromUser.badges) },
    toUser: { ...request.toUser, status: request.toUser.status as 'online' | 'offline' | 'away', isSystem: request.toUser.isSystem || false, badges: mapBadges(request.toUser.badges) },
  };

  try {
    const io = getIo();
    const toSocketId = await redis.get(`user:socket:${toUserId}`);
    if (toSocketId) {
      io.to(toSocketId).emit('friend:request', result);
    }
  } catch (err) {
    console.error('Failed to send friend request notification:', err);
  }

  return result;
}

export async function handleFriendRequest(
  userId: string,
  requestId: string,
  action: 'accept' | 'reject'
) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new Error('请求不存在');
  }

  if (request.toUserId !== userId) {
    throw new Error('无权处理此请求');
  }

  if (request.status !== 'pending') {
    throw new Error('请求已处理');
  }

  const updated = await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: action === 'accept' ? 'accepted' : 'rejected' },
  });

  if (action === 'accept') {
    const existingConv = await prisma.conversation.findFirst({
      where: {
        type: 'private',
        members: {
          every: { userId: { in: [request.fromUserId, request.toUserId] } },
        },
      },
      include: { members: true },
    });

    if (!existingConv || existingConv.members.length < 2) {
      await prisma.conversation.create({
        data: {
          type: 'private',
          creatorId: userId,
          ownerId: userId,
          members: {
            create: [
              { userId: request.fromUserId },
              { userId: request.toUserId },
            ],
          },
        },
      });
    }
  }

  return {
    id: updated.id,
    status: updated.status,
  };
}

export async function getFriendRequests(userId: string) {
  const received = await prisma.friendRequest.findMany({
    where: { toUserId: userId, status: 'pending' },
    include: {
      fromUser: { select: { id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const sent = await prisma.friendRequest.findMany({
    where: { fromUserId: userId, status: 'pending' },
    include: {
      toUser: { select: { id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mapBadges = (badges: any[]) => badges.map((ub: any) => ({
    type: ub.badge.type,
    label: ub.badge.label,
    icon: ub.badge.icon,
    color: ub.badge.color,
  }));

  return {
    received: received.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      fromUser: { ...r.fromUser, status: r.fromUser.status as 'online' | 'offline' | 'away', isSystem: r.fromUser.isSystem || false, badges: mapBadges(r.fromUser.badges) },
    })),
    sent: sent.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      toUser: { ...r.toUser, status: r.toUser.status as 'online' | 'offline' | 'away', isSystem: r.toUser.isSystem || false, badges: mapBadges(r.toUser.badges) },
    })),
  };
}

export async function getFriends(userId: string) {
  const accepted = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { fromUserId: userId, status: 'accepted' },
        { toUserId: userId, status: 'accepted' },
      ],
    },
    include: {
      fromUser: {
        select: {
          id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true,
          badges: { include: { badge: true } },
        },
      },
      toUser: {
        select: {
          id: true, biuId: true, username: true, nickname: true, avatar: true, status: true, isSystem: true,
          badges: { include: { badge: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return accepted.map((r) => {
    const friend = r.fromUserId === userId ? r.toUser : r.fromUser;
    return {
      id: friend.id,
      biuId: friend.biuId,
      username: friend.username,
      nickname: friend.nickname,
      avatar: friend.avatar,
      status: friend.status as 'online' | 'offline' | 'away',
      isSystem: friend.isSystem || false,
      badges: friend.badges.map((ub: any) => ({
        type: ub.badge.type,
        label: ub.badge.label,
        icon: ub.badge.icon,
        color: ub.badge.color,
      })),
    };
  });
}

export async function deleteFriend(userId: string, friendId: string) {
  if (friendId === 'system') {
    throw new Error('无法删除系统账号');
  }

  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId: userId, toUserId: friendId, status: 'accepted' },
        { fromUserId: friendId, toUserId: userId, status: 'accepted' },
      ],
    },
  });

  if (!friendRequest) {
    throw new Error('不是好友关系');
  }

  await prisma.friendRequest.delete({
    where: { id: friendRequest.id },
  });

  return { success: true };
}
