import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SYSTEM_USER_ID = 'system';
const SYSTEM_USERNAME = 'biu_system';
const SYSTEM_BIU_ID = 'SYSTEM_Biu';
const SYSTEM_PASSWORD = 'this-is-not-a-login-account';

const BADGES = [
  { type: 'OFFICIAL', label: '官方', icon: 'shield', color: '#00D4AA', description: '官方账号' },
  { type: 'AI', label: 'AI', icon: 'cpu', color: '#8B5CF6', description: 'AI 助手' },
  { type: 'SYSTEM', label: '系统', icon: 'bell', color: '#3B82F6', description: '系统通知' },
  { type: 'VERIFIED', label: '认证', icon: 'check-circle', color: '#00D4AA', description: '认证用户' },
  { type: 'BOT', label: '机器人', icon: 'bot', color: '#F59E0B', description: '机器人' },
  { type: 'ENTERPRISE', label: '企业', icon: 'building', color: '#6366F1', description: '企业' },
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { id: SYSTEM_USER_ID } });
  if (existing) {
    console.log('System user already exists, skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(SYSTEM_PASSWORD, 10);

  await prisma.user.create({
    data: {
      id: SYSTEM_USER_ID,
      biuId: SYSTEM_BIU_ID,
      username: SYSTEM_USERNAME,
      passwordHash,
      nickname: 'Biu 系统',
      isSystem: true,
      status: 'online',
    },
  });
  console.log('System user created:', SYSTEM_USER_ID);

  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { id: badge.type.toLowerCase() + '_badge' },
      update: {},
      create: {
        id: badge.type.toLowerCase() + '_badge',
        type: badge.type,
        label: badge.label,
        icon: badge.icon,
        color: badge.color,
        description: badge.description,
      },
    });
  }
  console.log('Badges seeded.');

  await prisma.userBadge.upsert({
    where: { id: 'system_badge_link' },
    update: {},
    create: {
      id: 'system_badge_link',
      userId: SYSTEM_USER_ID,
      badgeId: 'system_badge',
    },
  });
  console.log('System user badge assigned.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
