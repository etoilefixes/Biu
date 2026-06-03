import { prisma } from '../../config/database';
import { generateConversationBiuId } from '../../utils/biuId';

export async function listRoles(userId: string) {
  const roles = await prisma.aiRole.findMany({
    where: {
      OR: [
        { visibility: 'public' },
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
  if (role.visibility !== 'public' && role.userId !== userId) throw new Error('无权访问此角色');

  return formatRole(role);
}

export async function createRole(
  userId: string,
  data: {
    name: string;
    avatar?: string;
    description?: string;
    systemPrompt?: string;
    speakingStyle?: string;
    forbiddenTopics?: string;
    greeting?: string;
    model?: string;
    useReasoning?: boolean;
    replyLength?: string;
    temperature?: number;
    maxTokens?: number;
    visibility?: string;
  }
) {
  const role = await prisma.aiRole.create({
    data: {
      name: data.name,
      avatar: data.avatar || null,
      description: data.description || null,
      systemPrompt: data.systemPrompt || null,
      speakingStyle: data.speakingStyle || null,
      forbiddenTopics: data.forbiddenTopics || null,
      greeting: data.greeting || null,
      model: data.model || null,
      useReasoning: data.useReasoning ?? false,
      replyLength: data.replyLength || 'medium',
      temperature: data.temperature ?? 0.7,
      maxTokens: data.maxTokens ?? 2000,
      visibility: data.visibility || 'public',
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
    systemPrompt?: string;
    speakingStyle?: string;
    forbiddenTopics?: string;
    greeting?: string;
    model?: string;
    useReasoning?: boolean;
    replyLength?: string;
    temperature?: number;
    maxTokens?: number;
    visibility?: string;
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
      ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
      ...(data.speakingStyle !== undefined && { speakingStyle: data.speakingStyle }),
      ...(data.forbiddenTopics !== undefined && { forbiddenTopics: data.forbiddenTopics }),
      ...(data.greeting !== undefined && { greeting: data.greeting }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.useReasoning !== undefined && { useReasoning: data.useReasoning }),
      ...(data.replyLength !== undefined && { replyLength: data.replyLength }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
      ...(data.visibility !== undefined && { visibility: data.visibility }),
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  });

  // 同步更新虚拟用户的昵称和头像
  await syncAiRoleUser(role);

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
 * AI 角色通过虚拟 User 复用现有 Conversation/Message 体系
 */
export async function chatWithRole(roleId: string, userId: string) {
  const role = await prisma.aiRole.findUnique({ where: { id: roleId } });
  if (!role) throw new Error('角色不存在');
  if (role.visibility !== 'public' && role.userId !== userId) throw new Error('无权与此角色聊天');

  const convName = `__ai_role__${roleId}`;

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'private',
      name: convName,
      members: {
        some: { userId },
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
    return {
      conversation: formatConversation(existing, userId),
      role: formatRole(role),
      isNew: false,
    };
  }

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
 * isSystem: false — AI 角色不是系统通知
 */
async function ensureAiRoleUser(role: { id: string; name: string; avatar: string | null }): Promise<string> {
  const aiUsername = `ai_role_${role.id.replace(/-/g, '_')}`;

  let user = await prisma.user.findUnique({ where: { username: aiUsername } });
  if (user) {
    if (user.nickname !== role.name || user.avatar !== role.avatar || user.isSystem) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { nickname: role.name, avatar: role.avatar, isSystem: false },
      });
    }
    return user.id;
  }

  const biuId = `AI${Date.now().toString().slice(-8)}`;

  user = await prisma.user.create({
    data: {
      biuId,
      username: aiUsername,
      passwordHash: '__ai_role_no_login__',
      nickname: role.name,
      avatar: role.avatar,
      status: 'online',
      isSystem: false,
      role: 'user',
    },
  });

  return user.id;
}

/** 角色更新时同步虚拟用户信息 */
async function syncAiRoleUser(role: { id: string; name: string; avatar: string | null }) {
  const aiUsername = `ai_role_${role.id.replace(/-/g, '_')}`;
  await prisma.user.updateMany({
    where: { username: aiUsername },
    data: { nickname: role.name, avatar: role.avatar, isSystem: false },
  });
}

function formatRole(role: any) {
  return {
    id: role.id,
    name: role.name,
    avatar: role.avatar,
    description: role.description,
    systemPrompt: role.systemPrompt,
    speakingStyle: role.speakingStyle,
    forbiddenTopics: role.forbiddenTopics,
    greeting: role.greeting,
    model: role.model,
    useReasoning: role.useReasoning,
    replyLength: role.replyLength,
    temperature: role.temperature,
    maxTokens: role.maxTokens,
    visibility: role.visibility,
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
