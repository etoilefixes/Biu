import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { generateConversationBiuId } from '../../utils/biuId';

const SALT_ROUNDS = 10;
const BIU_ID_START = 100001;
const MAX_BIU_ID_RETRIES = 3;

/** 获取系统用户 ID（从数据库查询 isSystem=true 的真实记录） */
async function getSystemUserId(txClient?: any): Promise<string | null> {
  const db = txClient || prisma;
  const systemUser = await db.user.findFirst({
    where: { isSystem: true },
    select: { id: true },
  });
  return systemUser?.id ?? null;
}

/**
 * 生成下一个用户 BiuId（纯数字编号，如 100001Biu、100002Biu）
 * - 只统计 isSystem=false 的真实用户，避免 SYSTEM_Biu / OFFICIAL_Biu 等污染
 * - 对 parseInt 结果做 NaN 防护
 * - 并发安全：外层 register() 捕获 P2002 后自动重试
 */
async function generateUserBiuId(txClient?: any): Promise<string> {
  const db = txClient || prisma;
  const lastUser = await db.user.findFirst({
    where: { isSystem: false },
    orderBy: { biuId: 'desc' },
    select: { biuId: true },
  });

  if (!lastUser) {
    return `${BIU_ID_START}Biu`;
  }

  const lastNum = parseInt(lastUser.biuId.replace('Biu', ''), 10);
  if (isNaN(lastNum)) {
    const count = await db.user.count({ where: { isSystem: false } });
    return `${BIU_ID_START + count}Biu`;
  }

  return `${lastNum + 1}Biu`;
}

function formatUser(user: any) {
  const badges = (user.badges || []).map((ub: any) => ({
    type: ub.badge.type,
    label: ub.badge.label,
    icon: ub.badge.icon,
    color: ub.badge.color,
  }));

  return {
    id: user.id,
    biuId: user.biuId,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    status: user.status as 'online' | 'offline' | 'away',
    isSystem: user.isSystem || false,
    role: user.role || 'user',
    officialStatus: user.officialStatus || 'none',
    badges,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** 自定义注册错误，携带 HTTP 状态码以便 Controller 区分 */
export class RegisterError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RegisterError';
    this.statusCode = statusCode;
  }
}

export async function register(data: { username: string; password: string; nickname: string }) {
  // 1. 用户名去重
  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    throw new RegisterError('用户名已存在', 409);
  }

  // 2. 密码哈希（放在事务外，避免 bcrypt 慢操作占用事务时间）
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // 3. 带重试的事务执行（处理 biuId 并发竞态）
  for (let attempt = 0; attempt < MAX_BIU_ID_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const biuId = await generateUserBiuId(tx);
        const convBiuId = generateConversationBiuId();
        const systemUserId = await getSystemUserId(tx);

        // 3a. 创建用户
        const user = await tx.user.create({
          data: { biuId, username: data.username, passwordHash, nickname: data.nickname },
          include: { badges: { include: { badge: true } } },
        });

        // 3b. 创建与系统用户的好友关系（系统用户不存在则跳过）
        if (systemUserId) {
          await tx.friendRequest.create({
            data: { fromUserId: systemUserId, toUserId: user.id, status: 'accepted' },
          });

          // 3c. 创建与系统用户的欢迎会话
          const conversation = await tx.conversation.create({
            data: {
              biuId: convBiuId,
              type: 'private',
              creatorId: systemUserId,
              ownerId: systemUserId,
              members: {
                create: [
                  { userId: systemUserId },
                  { userId: user.id },
                ],
              },
            },
          });

          // 3d. 发送欢迎消息
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: systemUserId,
              content: `欢迎加入 Biu团队！这里是 Biu 系统通知，有任何问题都可以随时联系我们 🎉`,
            },
          });
        }

        return user;
      });

      // 4. 生成 JWT（事务外执行，非数据库操作）
      const token = jwt.sign({ userId: result.id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as string,
      } as SignOptions);

      return { token, user: formatUser(result) };
    } catch (err: any) {
      // 唯一约束冲突（P2002）说明 biuId 或 username 重复，需要重试
      if (err.code === 'P2002' && attempt < MAX_BIU_ID_RETRIES - 1) {
        // 如果是 username 重复（非 biuId），直接抛出不重试
        if (err.meta?.target?.includes('username')) {
          throw new RegisterError('用户名已存在', 409);
        }
        continue; // biuId 冲突，下一轮重试
      }
      throw err;
    }
  }

  // 重试耗尽
  throw new RegisterError('注册失败，请稍后重试', 500);
}

export async function login(data: { account: string; password: string }) {
  const isBiuId = data.account.toUpperCase().endsWith('BIU');
  const user = isBiuId
    ? await prisma.user.findUnique({ where: { biuId: data.account.toUpperCase() }, include: { badges: { include: { badge: true } } } })
    : await prisma.user.findUnique({ where: { username: data.account }, include: { badges: { include: { badge: true } } } });

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
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { badges: { include: { badge: true } } } });
  if (!user) {
    throw new Error('用户不存在');
  }

  return formatUser(user);
}
