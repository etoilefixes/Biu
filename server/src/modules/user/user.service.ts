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
  const user = await prisma.user.update({
    where: { id: userId },
    data,
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
