import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { io } from '../../socket';

const SYSTEM_USER_ID = 'system';

export async function isOfficialUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role === 'official' || user?.role === 'admin';
}

export async function getAllUsers(officialUserId: string) {
  const isOfficial = await isOfficialUser(officialUserId);
  if (!isOfficial) throw new Error('无权限');

  const users = await prisma.user.findMany({
    where: { id: { not: SYSTEM_USER_ID } },
    include: { badges: { include: { badge: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return users.map(user => ({
    id: user.id,
    biuId: user.biuId,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    status: user.status,
    role: user.role,
    badges: (user.badges || []).map(ub => ({
      type: ub.badge.type,
      label: ub.badge.label,
      icon: ub.badge.icon,
      color: ub.badge.color,
    })),
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function deleteUser(officialUserId: string, targetUserId: string) {
  const isOfficial = await isOfficialUser(officialUserId);
  if (!isOfficial) throw new Error('无权限');
  if (targetUserId === SYSTEM_USER_ID) throw new Error('无法删除系统用户');

  await prisma.user.delete({ where: { id: targetUserId } });
  return { success: true };
}

export async function createOfficialChannel(
  officialUserId: string,
  data: { name: string; memberIds: string[] }
) {
  const isOfficial = await isOfficialUser(officialUserId);
  if (!isOfficial) throw new Error('无权限');

  const conversation = await prisma.conversation.create({
    data: {
      type: 'group',
      name: data.name,
      creatorId: officialUserId,
      ownerId: officialUserId,
      members: {
        create: [
          { userId: officialUserId },
          ...data.memberIds.map(id => ({ userId: id })),
        ],
      },
    },
    include: { members: { include: { user: true } } },
  });

  io?.to(officialUserId).emit('conversation:created', {
    id: conversation.id,
    type: 'group',
    name: conversation.name,
    createdAt: conversation.createdAt.toISOString(),
  });

  return {
    id: conversation.id,
    type: 'group' as const,
    name: conversation.name,
    creatorId: conversation.creatorId,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export async function sendBroadcast(
  officialUserId: string,
  data: { title: string; content: string; cardType?: string }
) {
  const isOfficial = await isOfficialUser(officialUserId);
  if (!isOfficial) throw new Error('无权限');

  const allUsers = await prisma.user.findMany({
    where: { id: { not: SYSTEM_USER_ID } },
    select: { id: true },
  });

  const results = [];

  for (const user of allUsers) {
    const conversation = await prisma.conversation.create({
      data: {
        type: 'private',
        creatorId: SYSTEM_USER_ID,
        ownerId: SYSTEM_USER_ID,
        members: {
          create: [
            { userId: SYSTEM_USER_ID },
            { userId: user.id },
          ],
        },
      },
    });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: officialUserId,
        content: data.content,
        type: 'card',
        cardType: data.cardType || 'broadcast',
        cardData: JSON.stringify({ title: data.title, body: data.content }),
      },
    });

    io?.to(user.id).emit('message:received', {
      id: message.id,
      conversationId: conversation.id,
      content: message.content,
      type: 'card',
      cardType: data.cardType || 'broadcast',
      cardData: { title: data.title, body: data.content },
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: officialUserId,
        nickname: 'Biu 官方',
      },
    });

    results.push({ userId: user.id, messageId: message.id });
  }

  return { sent: results.length, success: true };
}

export async function setUserRole(
  officialUserId: string,
  targetUserId: string,
  role: 'user' | 'admin' | 'official'
) {
  const isOfficial = await isOfficialUser(officialUserId);
  if (!isOfficial) throw new Error('无权限');

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    include: { badges: { include: { badge: true } } },
  });

  if (role === 'official' || role === 'admin') {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: targetUserId, badgeId: 'official_badge' } },
      update: {},
      create: {
        id: `${targetUserId}_official`,
        userId: targetUserId,
        badgeId: 'official_badge',
      },
    });
  }

  return {
    id: user.id,
    biuId: user.biuId,
    nickname: user.nickname,
    role: user.role,
  };
}
