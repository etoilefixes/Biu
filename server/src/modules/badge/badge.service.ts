import { prisma } from '../../config/database';

export async function listBadges() {
  const badges = await prisma.badge.findMany();
  return badges.map((b) => ({
    type: b.type,
    label: b.label,
    icon: b.icon,
    color: b.color,
    description: b.description,
  }));
}

export async function getUserBadges(userId: string) {
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });
  return userBadges.map((ub) => ({
    type: ub.badge.type,
    label: ub.badge.label,
    icon: ub.badge.icon,
    color: ub.badge.color,
    description: ub.badge.description,
    createdAt: ub.createdAt.toISOString(),
  }));
}

export async function assignBadge(userId: string, badgeType: string) {
  const badge = await prisma.badge.findFirst({ where: { type: badgeType } });
  if (!badge) {
    throw new Error('徽章类型不存在');
  }

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) {
    throw new Error('该用户已拥有此徽章');
  }

  const userBadge = await prisma.userBadge.create({
    data: { userId, badgeId: badge.id },
    include: { badge: true },
  });

  return {
    type: userBadge.badge.type,
    label: userBadge.badge.label,
    icon: userBadge.badge.icon,
    color: userBadge.badge.color,
  };
}
