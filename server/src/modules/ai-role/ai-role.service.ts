import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { generateConversationBiuId } from '../../utils/biuId';
import * as badgeService from '../badge/badge.service';
import { canUpdateAiCharacter, canDeleteAiCharacter, canUpdateAiCharacterOverride } from '../auth/permissions';

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

  const formatted = roles.map(formatRole);
  return mergeUserConfigs(formatted, userId);
}

export async function getRole(id: string, userId: string) {
  return getRoleWithUserConfig(id, userId);
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
  const MAX_TOKENS_LIMIT = 393216;

  const existing = await prisma.aiRole.findUnique({ where: { id } });
  if (!existing) throw new Error('角色不存在');

  const isOwner = canUpdateAiCharacter(userId, existing);

  // AI 参数字段：所有用户都可以修改（非创建者通过用户级覆盖表）
  const aiParamFields = ['model', 'useReasoning', 'replyLength', 'temperature', 'maxTokens'] as const;
  const hasAiParamData = aiParamFields.some((f) => data[f] !== undefined);

  if (isOwner) {
    // 创建者：直接更新角色记录
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
        ...(data.maxTokens !== undefined && { maxTokens: Math.min(Math.max(data.maxTokens, 1), MAX_TOKENS_LIMIT) }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
      },
      include: {
        creator: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    await syncAiRoleUser(role);
    return formatRole(role);
  }

  // 非创建者：只能修改 AI 参数，通过用户级覆盖表
  const nonAiParamFields = ['name', 'avatar', 'description', 'systemPrompt', 'speakingStyle', 'forbiddenTopics', 'greeting', 'visibility'] as const;
  const hasNonAiParamData = nonAiParamFields.some((f) => data[f] !== undefined);
  if (hasNonAiParamData) throw new Error('无权修改角色的基本信息，仅可调整 AI 参数');

  if (hasAiParamData) {
    await prisma.aiRoleUserConfig.upsert({
      where: { roleId_userId: { roleId: id, userId } },
      update: {
        ...(data.model !== undefined && { model: data.model || null }),
        ...(data.useReasoning !== undefined && { useReasoning: data.useReasoning }),
        ...(data.replyLength !== undefined && { replyLength: data.replyLength }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.maxTokens !== undefined && { maxTokens: Math.min(Math.max(data.maxTokens, 1), MAX_TOKENS_LIMIT) }),
      },
      create: {
        roleId: id,
        userId,
        model: data.model || null,
        useReasoning: data.useReasoning ?? false,
        replyLength: data.replyLength || 'medium',
        temperature: data.temperature ?? 0.7,
        maxTokens: Math.min(Math.max(data.maxTokens ?? 2000, 1), MAX_TOKENS_LIMIT),
      },
    });
  }

  // 返回合并后的角色信息
  return getRoleWithUserConfig(id, userId);
}

export async function deleteRole(id: string, userId: string) {
  const existing = await prisma.aiRole.findUnique({ where: { id } });
  if (!existing) throw new Error('角色不存在');
  if (!canDeleteAiCharacter(userId, existing)) throw new Error('无权删除此角色');

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
    // 确保 AI 徽章存在
    try {
      await badgeService.assignBadge(user.id, 'AI');
    } catch {
      // 徽章已存在，忽略
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

  // 自动分配 AI 身份徽章
  try {
    await badgeService.assignBadge(user.id, 'AI');
  } catch {
    // 徽章已存在或徽章类型未初始化，忽略
  }

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

/** 获取角色信息并合并用户级 AI 参数覆盖 */
async function getRoleWithUserConfig(roleId: string, userId: string) {
  const role = await prisma.aiRole.findUnique({
    where: { id: roleId },
    include: {
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  });
  if (!role) throw new Error('角色不存在');
  if (role.visibility !== 'public' && role.userId !== userId) throw new Error('无权访问此角色');

  const formatted = formatRole(role);

  const userConfig = await prisma.aiRoleUserConfig.findUnique({
    where: { roleId_userId: { roleId, userId } },
  });

  if (userConfig) {
    formatted.model = userConfig.model;
    formatted.useReasoning = userConfig.useReasoning;
    formatted.replyLength = userConfig.replyLength;
    formatted.temperature = userConfig.temperature;
    formatted.maxTokens = userConfig.maxTokens;
    (formatted as any).hasUserConfig = true;
  }

  return formatted;
}

/** 合并用户级覆盖到角色列表 */
async function mergeUserConfigs(roles: any[], userId: string) {
  const roleIds = roles.map((r) => r.id);
  const configs = await prisma.aiRoleUserConfig.findMany({
    where: { roleId: { in: roleIds }, userId },
  });
  const configMap = new Map(configs.map((c) => [c.roleId, c]));

  return roles.map((role) => {
    const config = configMap.get(role.id);
    if (config) {
      return {
        ...role,
        model: config.model,
        useReasoning: config.useReasoning,
        replyLength: config.replyLength,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        hasUserConfig: true,
      };
    }
    return role;
  });
}

/**
 * 清除 AI 会话的模型上下文（不删除消息，只设置上下文断点）
 * AI 后续回复将只使用断点之后的消息作为上下文
 * 同时发送一条系统消息到会话中提示用户
 */
export async function clearConversationMessages(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: { select: { id: true, nickname: true, username: true } },
        },
      },
    },
  });

  if (!conversation) throw new Error('会话不存在');

  const isMember = conversation.members.some((m) => m.userId === userId);
  if (!isMember) throw new Error('无权操作此会话');

  // 设置上下文断点：AI 后续只看此时间之后的消息
  const cutoffTime = new Date().toISOString();
  await redis.set(`ai:context_cutoff:${conversationId}`, cutoffTime);

  // 确定 AI 角色名称
  const aiMember = conversation.members.find((m) => m.user?.username?.startsWith('ai_role_'));
  const aiRoleName = aiMember?.nickname || aiMember?.user?.nickname || 'AI';

  // 确定会话名称
  const convName = conversation.type === 'group'
    ? (conversation.name?.startsWith('__ai_role__') ? aiRoleName : conversation.name)
    : aiRoleName;

  // 发送系统消息提示上下文已清除
  const systemUser = await prisma.user.findFirst({ where: { isSystem: true } });
  if (systemUser) {
    const systemMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: systemUser.id,
        content: `${aiRoleName}在${convName}的上下文已被清除`,
        type: 'system',
        cardType: 'group_announcement',
        cardData: JSON.stringify({
          actorName: aiRoleName,
          newValue: `${aiRoleName}在${convName}的上下文已被清除`,
        }),
      },
      include: {
        sender: { select: { id: true, nickname: true, isSystem: true, badges: true } },
      },
    });

    // 通过 Socket 推送系统消息
    const { getIo } = await import('../../socket');
    const io = getIo();
    for (const member of conversation.members) {
      const socketId = await redis.get(`user:socket:${member.userId}`);
      if (socketId) {
        io.to(socketId).emit('chat:message', systemMsg);
      }
    }
  }

  return { cutoffTime, aiRoleName, convName };
}

/**
 * 删除 AI 最后一条回复，并重新生成
 */
export async function regenerateLastReply(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: { select: { userId: true } },
    },
  });

  if (!conversation) throw new Error('会话不存在');
  if (!conversation.name?.startsWith('__ai_role__')) throw new Error('非 AI 角色会话');

  const isMember = conversation.members.some((m) => m.userId === userId);
  if (!isMember) throw new Error('无权操作此会话');

  const roleId = conversation.name.replace('__ai_role__', '');
  const role = await prisma.aiRole.findUnique({ where: { id: roleId } });
  if (!role) throw new Error('AI 角色不存在');

  const aiUsername = `ai_role_${roleId.replace(/-/g, '_')}`;
  const aiUser = await prisma.user.findUnique({ where: { username: aiUsername } });
  if (!aiUser) throw new Error('AI 用户不存在');

  // 找到 AI 的最后一条消息并删除
  const lastAiMessage = await prisma.message.findFirst({
    where: { conversationId, senderId: aiUser.id },
    orderBy: { createdAt: 'desc' },
  });

  if (lastAiMessage) {
    await prisma.message.delete({ where: { id: lastAiMessage.id } });
  }

  // 触发重新生成（手动重新生成不受触发模式限制）
  const { generateAiReply } = await import('./ai-llm.service');
  generateAiReply(conversationId, userId, '').catch((err) => {
    console.error('[AI Regenerate] Failed:', err);
  });

  return { success: true };
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
