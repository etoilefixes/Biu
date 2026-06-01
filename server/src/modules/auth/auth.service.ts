import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';

const SALT_ROUNDS = 10;
const BIU_ID_START = 100001;
const SYSTEM_USER_ID = 'system';

async function generateBiuId(): Promise<string> {
  const lastUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { biuId: true },
  });

  if (!lastUser) {
    return `${BIU_ID_START}Biu`;
  }

  const lastNum = parseInt(lastUser.biuId.replace('Biu', ''), 10);
  return `${lastNum + 1}Biu`;
}

function formatUser(user: any) {
  return {
    id: user.id,
    biuId: user.biuId,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    status: user.status as 'online' | 'offline' | 'away',
    isSystem: user.isSystem || false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function register(data: { username: string; password: string; nickname: string }) {
  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  const biuId = await generateBiuId();
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      biuId,
      username: data.username,
      passwordHash,
      nickname: data.nickname,
    },
  });

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  } as SignOptions);

  await prisma.friendRequest.create({
    data: {
      fromUserId: SYSTEM_USER_ID,
      toUserId: user.id,
      status: 'accepted',
    },
  });

  await prisma.conversation.create({
    data: {
      type: 'private',
      creatorId: SYSTEM_USER_ID,
      members: {
        create: [
          { userId: SYSTEM_USER_ID },
          { userId: user.id },
        ],
      },
    },
  });

  return { token, user: formatUser(user) };
}

export async function login(data: { account: string; password: string }) {
  const isBiuId = data.account.toUpperCase().endsWith('BIU');
  const user = isBiuId
    ? await prisma.user.findUnique({ where: { biuId: data.account.toUpperCase() } })
    : await prisma.user.findUnique({ where: { username: data.account } });

  if (!user) {
    throw new Error('账号或密码错误');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new Error('账号或密码错误');
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  } as SignOptions);

  return { token, user: formatUser(user) };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('用户不存在');
  }

  return formatUser(user);
}
