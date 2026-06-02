import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = 'biu_official';
  const password = 'official123';
  const nickname = 'Biu 官方';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log('官方账号已存在，跳过创建');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const biuId = 'OFFICIAL_Biu';

  const user = await prisma.user.create({
    data: {
      biuId,
      username,
      passwordHash,
      nickname,
      role: 'official',
      status: 'online',
    },
    include: { badges: { include: { badge: true } } },
  });

  // 分配官方徽章
  const officialBadge = await prisma.badge.findFirst({ where: { type: 'OFFICIAL' } });
  if (officialBadge) {
    await prisma.userBadge.create({
      data: {
        userId: user.id,
        badgeId: officialBadge.id,
      },
    });
  }

  console.log('官方账号创建成功！');
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
