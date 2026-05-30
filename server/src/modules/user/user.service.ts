import { prisma } from '../../config/database';

export async function searchUsers(keyword: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: keyword, mode: 'insensitive' } },
        { nickname: { contains: keyword, mode: 'insensitive' } },
      ],
      NOT: { id: currentUserId },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 20,
  });

  return users.map((u) => ({
    ...u,
    status: u.status as 'online' | 'offline' | 'away',
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
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...user,
    status: user.status as 'online' | 'offline' | 'away',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
