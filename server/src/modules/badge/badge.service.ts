import { prisma } from '../../config/database';
import { canAccessAdmin } from '../auth/permissions';

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

/**
 * 颁发徽章核心逻辑（无权限检查）— 供系统内部调用使用
 * 如 AI 角色创建时自动分配 AI 徽章
 */
async function assignBadgeInternal(targetUserId: string, badgeType: string) {
  const badge = await prisma.badge.findFirst({ where: { type: badgeType } });
  if (!badge) {
    throw new Error('徽章类型不存在');
  }

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId: targetUserId, badgeId: badge.id } },
  });
  if (existing) {
    throw new Error('该用户已拥有此徽章');
  }

  const userBadge = await prisma.userBadge.create({
    data: { userId: targetUserId, badgeId: badge.id },
    include: { badge: true },
  });

  return {
    type: userBadge.badge.type,
    label: userBadge.badge.label,
    icon: userBadge.badge.icon,
    color: userBadge.badge.color,
  };
}

/**
 * 颁发徽章 — 仅管理员/超级管理员可调用
 * @param callerUserId 调用者用户 ID（用于权限校验）
 * @param targetUserId 被颁发徽章的用户 ID
 * @param badgeType 徽章类型
 */
export async function assignBadge(callerUserId: string, targetUserId: string, badgeType: string) {
  // 权限校验：仅管理员/超级管理员可颁发徽章
  // （原实现无任何权限校验，任意已登录用户可颁发任意徽章）
  const caller = await prisma.user.findUnique({
    where: { id: callerUserId },
    select: { role: true, status: true },
  });
  if (!caller || !canAccessAdmin(caller)) {
    throw new Error('无权限颁发徽章，仅管理员可操作');
  }

  return assignBadgeInternal(targetUserId, badgeType);
}

/**
 * 系统内部颁发徽章 — 跳过权限检查，仅供可信系统流程调用
 * 如 AI 角色创建时自动分配 AI 徽章
 */
export async function assignBadgeSystem(targetUserId: string, badgeType: string) {
  return assignBadgeInternal(targetUserId, badgeType);
}
