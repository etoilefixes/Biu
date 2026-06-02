import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = 'biu_ai';
  const password = 'ai123456';
  const nickname = 'Biu AI';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log('AI账号已存在，跳过创建');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const biuId = 'AI_Biu';

  const user = await prisma.user.create({
    data: {
      biuId,
      username,
      passwordHash,
      nickname,
      role: 'user',
      status: 'online',
    },
    include: { badges: { include: { badge: true } } },
  });

  const aiBadge = await prisma.badge.findFirst({ where: { type: 'AI' } });
  if (aiBadge) {
    await prisma.userBadge.create({
      data: {
        userId: user.id,
        badgeId: aiBadge.id,
      },
    });
  }

  console.log('AI账号创建成功！');
  console.log('账号:', username);
  console.log('密码:', password);
  console.log('BiuId:', biuId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
