import { prisma } from '../../config/database';

export async function searchUsers(keyword: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: keyword, mode: 'insensitive' } },
        { nickname: { contains: keyword, mode: 'insensitive' } },
        { biuId: { contains: keyword.toUpperCase(), mode: 'insensitive' } },
      ],
      NOT: { id: currentUserId },
    },
    select: {
      id: true,
      biuId: true,
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      badges: { include: { badge: true } },
    },
    take: 20,
  });

  return users.map((u) => ({
    ...u,
    status: u.status as 'online' | 'offline' | 'away',
    isSystem: u.isSystem || false,
    badges: u.badges.map((ub: any) => ({
      type: ub.badge.type,
      label: ub.badge.label,
      icon: ub.badge.icon,
      color: ub.badge.color,
    })),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
}

export async function updateProfile(userId: string, data: { nickname?: string; avatar?: string }) {
  // 字段白名单过滤：仅允许更新 nickname 和 avatar，防止 Mass Assignment 提权
  // （原实现直接透传 data，攻击者可传 { role: 'super_admin' } 自行提权）
  const safeData: { nickname?: string; avatar?: string } = {};
  if (typeof data.nickname === 'string') {
    safeData.nickname = data.nickname;
  }
  if (typeof data.avatar === 'string') {
    safeData.avatar = data.avatar;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: safeData,
    select: {
      id: true,
      biuId: true,
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      badges: { include: { badge: true } },
    },
  });

  return {
    ...user,
    status: user.status as 'online' | 'offline' | 'away',
    isSystem: user.isSystem || false,
    badges: user.badges.map((ub: any) => ({
      type: ub.badge.type,
      label: ub.badge.label,
      icon: ub.badge.icon,
      color: ub.badge.color,
    })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
