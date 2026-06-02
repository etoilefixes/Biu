import { prisma } from '../../config/database';
import { generateConversationBiuId } from '../../utils/biuId';

export async function listRoles(userId: string) {
  // 返回公开角色 + 自己创建的角色
  const roles = await prisma.aiRole.findMany({
    where: {
      OR: [
        { isPublic: true },
        { userId },
      ],
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return roles.map(formatRole);
}

export async function getRole(id: string, userId: string) {
  const role = await prisma.aiRole.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  });

  if (!role) throw new Error('角色不存在');
  if (!role.isPublic && role.userId !== userId) throw new Error('无权访问此角色');

  return formatRole(role);
}

export async function createRole(
  userId: string,
  data: {
    name: string;
    avatar?: string;
    description?: string;
    personality?: string;
    speakingStyle?: string;
    forbiddenTopics?: string;
    greeting?: string;
    replyLength?: string;
    temperature?: number;
    isPublic?: boolean;
  }
) {
  const role = await prisma.aiRole.create({
    data: {
      name: data.name,
      avatar: data.avatar || null,
      description: data.description || null,
      personality: data.personality || null,
      speakingStyle: data.speakingStyle || null,
      forbiddenTopics: data.forbiddenTopics || null,
      greeting: data.greeting || null,
      replyLength: data.replyLength || 'medium',
      temperature: data.temperature ?? 0.7,
      isPublic: data.isPublic ?? true,
      userId,
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  });

  return formatRole(role);
}

export async function updateRole(
  id: string,
  userId: string,
  data: {
    name?: string;
    avatar?: string;
    description?: string;
    personality?: string;
    speakingStyle?: string;
    forbiddenTopics?: string;
    greeting?: string;
    replyLength?: string;
    temperature?: number;
    isPublic?: boolean;
  }
) {
  const existing = await prisma.aiRole.findUnique({ where: { id } });
  if (!existing) throw new Error('角色不存在');
  if (existing.userId !== userId) throw new Error('无权修改此角色');

  const role = await prisma.aiRole.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.personality !== undefined && { personality: data.personality }),
      ...(data.speakingStyle !== undefined && { speakingStyle: data.speakingStyle }),
      ...(data.forbiddenTopics !== undefined && { forbiddenTopics: data.forbiddenTopics }),
      ...(data.greeting !== undefined && { greeting: data.greeting }),
      ...(data.replyLength !== undefined && { replyLength: data.replyLength }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  });

  return formatRole(role);
}

export async function deleteRole(id: string, userId: string) {
  const existing = await prisma.aiRole.findUnique({ where: { id } });
  if (!existing) throw new Error('角色不存在');
  if (existing.userId !== userId) throw new Error('无权删除此角色');

  await prisma.aiRole.delete({ where: { id } });
  return { success: true };
}

/**
 * 点击角色后，创建或获取与该角色的私聊会话
 * AI 角色不需要对应真实 User，会话通过 AiRole 关联
 * 使用 AiRole 的 id 作为虚拟 userId 存储在 ConversationMember 中
 */
export async function chatWithRole(roleId: string, userId: string) {
  const role = await prisma.aiRole.findUnique({ where: { id: roleId } });
  if (!role) throw new Error('角色不存在');
  if (!role.isPublic && role.userId !== userId) throw new Error('无权与此角色聊天');

  // 查找是否已有该角色的会话（通过 conversation name 标识 AI 角色会话）
  // 使用约定：AI 角色会话的 name 格式为 `__ai_role__${roleId}`
  const convName = `__ai_role__${roleId}`;

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'private',
      name: convName,
      members: {
        every: {
          userId: { in: [userId] },
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
          },
        },
      },
    },
  });

  if (existing) {
    // 检查当前用户是否是成员
    const isMember = existing.members.some((m) => m.userId === userId);
    if (isMember) {
      return {
        conversation: formatConversation(existing, userId),
        role: formatRole(role),
        isNew: false,
      };
    }
  }

  // 创建新会话
  // AI 角色作为虚拟成员加入，使用 `ai_role_${roleId}` 作为 userId
  // 需要先确保有一个对应的虚拟 User
  const aiUserId = await ensureAiRoleUser(role);

  const conversation = await prisma.conversation.create({
    data: {
      biuId: generateConversationBiuId(),
      type: 'private',
      name: convName,
      creatorId: userId,
      ownerId: userId,
      members: {
        create: [
          { userId, role: 'owner' },
          { userId: aiUserId, role: 'member' },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true, isSystem: true, badges: { include: { badge: true } } },
          },
        },
      },
    },
  });

  // 如果角色有开场白，自动发送
  if (role.greeting) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: aiUserId,
        content: role.greeting,
        type: 'text',
      },
    });
  }

  return {
    conversation: formatConversation(conversation, userId),
    role: formatRole(role),
    isNew: true,
  };
}

/**
 * 确保 AI 角色有一个对应的虚拟 User 记录
 * 这样可以复用现有的 Conversation/Message 体系
 */
async function ensureAiRoleUser(role: { id: string; name: string; avatar: string | null }): Promise<string> {
  const aiUsername = `ai_role_${role.id.replace(/-/g, '_')}`;

  let user = await prisma.user.findUnique({ where: { username: aiUsername } });
  if (user) return user.id;

  // 生成 biuId
  const biuId = `AI${Date.now().toString().slice(-8)}`;

  user = await prisma.user.create({
    data: {
      biuId,
      username: aiUsername,
      passwordHash: '__ai_role_no_login__',
      nickname: role.name,
      avatar: role.avatar,
      status: 'online',
      isSystem: true,
      role: 'user',
    },
  });

  return user.id;
}

function formatRole(role: any) {
  return {
    id: role.id,
    name: role.name,
    avatar: role.avatar,
    description: role.description,
    personality: role.personality,
    speakingStyle: role.speakingStyle,
    forbiddenTopics: role.forbiddenTopics,
    greeting: role.greeting,
    replyLength: role.replyLength,
    temperature: role.temperature,
    isPublic: role.isPublic,
    userId: role.userId,
    creator: role.creator,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

function formatConversation(conversation: any, currentUserId: string) {
  return {
    id: conversation.id,
    biuId: conversation.biuId,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    ownerId: conversation.ownerId,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      nickname: m.nickname,
      role: m.role as 'owner' | 'admin' | 'member',
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
        isSystem: m.user.isSystem || false,
        badges: m.user.badges.map((ub: any) => ({
          type: ub.badge.type,
          label: ub.badge.label,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
      },
    })),
  };
}
