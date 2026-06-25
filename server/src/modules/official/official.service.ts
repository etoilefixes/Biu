import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { io } from '../../socket';
import { generateConversationBiuId } from '../../utils/biuId';
import { canAccessAdmin, canUpdateUserRole, canUpdateOfficialStatus, Permission, hasSystemPermission } from '../auth/permissions';

/** 获取系统用户 ID。用于过滤/保护系统用户，以及作为系统操作的 actor。 */
async function getSystemUserId(): Promise<string | null> {
  const systemUser = await prisma.user.findFirst({
    where: { isSystem: true },
    select: { id: true },
  });
  return systemUser?.id ?? null;
}

export async function isOfficialUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return canAccessAdmin(user);
}

export async function getAllUsers(officialUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: officialUserId } });
  if (!user || !hasSystemPermission(user, Permission.UserRead)) throw new Error('无权限');

  const users = await prisma.user.findMany({
    where: { isSystem: false },
    include: { badges: { include: { badge: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return users.map(u => ({
    id: u.id,
    biuId: u.biuId,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    status: u.status,
    role: u.role,
    officialStatus: u.officialStatus,
    badges: (u.badges || []).map(ub => ({
      type: ub.badge.type,
      label: ub.badge.label,
      icon: ub.badge.icon,
      color: ub.badge.color,
    })),
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function deleteUser(officialUserId: string, targetUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: officialUserId } });
  if (!user || !hasSystemPermission(user, Permission.UserDelete)) throw new Error('无权限');

  const systemUserId = await getSystemUserId();
  if (systemUserId && targetUserId === systemUserId) throw new Error('无法删除系统用户');
  if (targetUserId === officialUserId) throw new Error('不能删除自己');

  await prisma.user.delete({ where: { id: targetUserId } });
  return { success: true };
}

export async function createOfficialChannel(
  officialUserId: string,
  data: { name: string; memberIds: string[] }
) {
  const user = await prisma.user.findUnique({ where: { id: officialUserId } });
  if (!user || !hasSystemPermission(user, Permission.OfficialChannelCreate)) throw new Error('无权限');

  const conversation = await prisma.conversation.create({
    data: {
      biuId: generateConversationBiuId(),
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
  const user = await prisma.user.findUnique({ where: { id: officialUserId } });
  if (!user || !hasSystemPermission(user, Permission.OfficialBroadcast)) throw new Error('无权限');

  const allUsers = await prisma.user.findMany({
    where: { isSystem: false },
    select: { id: true },
  });

  const systemUserId = await getSystemUserId();

  const results = [];

  for (const u of allUsers) {
    // 如果没有系统用户则使用 officialUserId 作为 creator
    const creatorId = systemUserId || officialUserId;
    const conversation = await prisma.conversation.create({
      data: {
        biuId: generateConversationBiuId(),
        type: 'private',
        creatorId,
        ownerId: creatorId,
        members: {
          create: [
            { userId: creatorId },
            { userId: u.id },
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

    io?.to(u.id).emit('message:received', {
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

    results.push({ userId: u.id, messageId: message.id });
  }

  return { sent: results.length, success: true };
}

export async function setUserRole(
  officialUserId: string,
  targetUserId: string,
  role: 'user' | 'admin' | 'super_admin'
) {
  const actor = await prisma.user.findUnique({ where: { id: officialUserId } });
  if (!actor) throw new Error('用户不存在');

  // 修改角色需要 UserRoleUpdate 权限（仅 super_admin）
  if (!canUpdateUserRole(actor)) throw new Error('无权修改用户角色，需要超级管理员权限');
  if (officialUserId === targetUserId) throw new Error('不能修改自己的角色');

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    include: { badges: { include: { badge: true } } },
  });

  return {
    id: user.id,
    biuId: user.biuId,
    nickname: user.nickname,
    role: user.role,
  };
}

export async function setUserOfficialStatus(
  actorUserId: string,
  targetUserId: string,
  officialStatus: 'none' | 'verified'
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new Error('用户不存在');

  if (!canUpdateOfficialStatus(actor)) throw new Error('无权修改官方认证状态');
  if (actorUserId === targetUserId) throw new Error('不能修改自己的认证状态');

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { officialStatus },
    include: { badges: { include: { badge: true } } },
  });

  // 官方认证用户自动分配官方徽章
  if (officialStatus === 'verified') {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: targetUserId, badgeId: 'official_badge' } },
      update: {},
      create: {
        id: `${targetUserId}_official`,
        userId: targetUserId,
        badgeId: 'official_badge',
      },
    });
  } else {
    // 取消认证时移除官方徽章
    await prisma.userBadge.deleteMany({
      where: { userId: targetUserId, badgeId: 'official_badge' },
    });
  }

  return {
    id: user.id,
    biuId: user.biuId,
    nickname: user.nickname,
    role: user.role,
    officialStatus: user.officialStatus,
  };
}
