import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UpsertData {
  conversationId: string;
  muted?: boolean;
  showPreview?: boolean;
}

export async function listByUser(userId: string) {
  return prisma.notificationSetting.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsert(userId: string, data: UpsertData) {
  // Prisma compound unique key 不支持 null，null 表示全局设置，用空字符串占位
  const convId = data.conversationId ?? '';

  return prisma.notificationSetting.upsert({
    where: {
      userId_conversationId: {
        userId,
        conversationId: convId,
      },
    },
    update: {
      ...(data.muted !== undefined && { muted: data.muted }),
      ...(data.showPreview !== undefined && { showPreview: data.showPreview }),
    },
    create: {
      userId,
      conversationId: convId,
      muted: data.muted ?? false,
      showPreview: data.showPreview ?? true,
    },
  });
}

export async function remove(userId: string, id: string) {
  const setting = await prisma.notificationSetting.findFirst({
    where: { id, userId },
  });
  if (!setting) {
    throw new Error('通知设置不存在');
  }
  return prisma.notificationSetting.delete({ where: { id } });
}
