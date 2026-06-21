/**
 * 统一权限模块 — 轻量版 RBAC + ABAC
 *
 * 系统角色 → 映射权限点 → 资源上下文补充判断
 */

// ==================== 权限点枚举 ====================

export enum Permission {
  // 后台
  AdminAccess = 'admin.access',

  // 用户管理
  UserRead = 'user.read',
  UserRoleUpdate = 'user.role.update',
  UserOfficialUpdate = 'user.official.update',
  UserDelete = 'user.delete',

  // 群聊
  ConversationUpdate = 'conversation.update',
  ConversationDelete = 'conversation.delete',
  ConversationMemberRemove = 'conversation.member.remove',
  ConversationMemberRoleUpdate = 'conversation.member.role.update',
  ConversationOwnerTransfer = 'conversation.owner.transfer',

  // AI 角色
  AiCharacterCreate = 'ai.character.create',
  AiCharacterUpdate = 'ai.character.update',
  AiCharacterDelete = 'ai.character.delete',
  AiCharacterOverrideUpdate = 'ai.character.override.update',

  // 官方操作
  OfficialBroadcast = 'official.broadcast',
  OfficialChannelCreate = 'official.channel.create',
}

// ==================== 系统角色 → 权限映射 ====================

export type SystemRole = 'user' | 'admin' | 'super_admin';

const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  user: [
    Permission.AiCharacterCreate,
  ],
  admin: [
    Permission.AdminAccess,
    Permission.UserRead,
    Permission.UserOfficialUpdate,
    Permission.UserDelete,
    Permission.OfficialBroadcast,
    Permission.OfficialChannelCreate,
    Permission.AiCharacterCreate,
    Permission.AiCharacterUpdate,
    Permission.AiCharacterDelete,
  ],
  super_admin: [
    Permission.AdminAccess,
    Permission.UserRead,
    Permission.UserRoleUpdate,
    Permission.UserOfficialUpdate,
    Permission.UserDelete,
    Permission.OfficialBroadcast,
    Permission.OfficialChannelCreate,
    Permission.AiCharacterCreate,
    Permission.AiCharacterUpdate,
    Permission.AiCharacterDelete,
  ],
};

// ==================== 系统级权限判断 ====================

interface HasPermissionUser {
  role: string;
  status: string;
}

/**
 * 判断用户是否拥有某个系统级权限
 * 基于角色映射，status 字段为用户在线状态（online/offline/away），不影响权限判断
 */
export function hasSystemPermission(user: HasPermissionUser, permission: Permission): boolean {
  const permissions = SYSTEM_ROLE_PERMISSIONS[user.role as SystemRole] ?? [];
  return permissions.includes(permission);
}

/**
 * 判断用户是否可以访问管理后台
 */
export function canAccessAdmin(user: HasPermissionUser): boolean {
  return hasSystemPermission(user, Permission.AdminAccess);
}

/**
 * 判断用户是否可以修改其他用户角色
 */
export function canUpdateUserRole(actor: HasPermissionUser): boolean {
  return hasSystemPermission(actor, Permission.UserRoleUpdate);
}

/**
 * 判断用户是否可以修改官方认证状态
 */
export function canUpdateOfficialStatus(actor: HasPermissionUser): boolean {
  return hasSystemPermission(actor, Permission.UserOfficialUpdate);
}

// ==================== 群聊资源级权限 ====================

export type ConversationRole = 'owner' | 'admin' | 'member';

export type ConversationAction =
  | 'update'           // 修改群名称/公告
  | 'delete'           // 解散群聊
  | 'member.remove'    // 移除成员
  | 'member.role'      // 设置/取消管理员
  | 'owner.transfer'   // 转让群主
  | 'nickname.update'; // 修改自己群昵称

/**
 * 群聊权限矩阵
 */
export function canConversationAction(
  actorRole: ConversationRole,
  action: ConversationAction,
  targetRole?: ConversationRole,
): boolean {
  if (actorRole === 'owner') return true;

  if (actorRole === 'admin') {
    switch (action) {
      case 'update':
      case 'nickname.update':
        return true;
      case 'member.remove':
        return targetRole === 'member';
      default:
        return false;
    }
  }

  // member
  return action === 'nickname.update';
}

/**
 * 是否有群管理权限（owner 或 admin）
 */
export function isConversationManager(role?: ConversationRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * 是否可以移除群成员
 */
export function canRemoveConversationMember(
  actorRole?: ConversationRole | null,
  targetRole?: ConversationRole | null,
): boolean {
  if (!actorRole || !targetRole) return false;
  return canConversationAction(actorRole, 'member.remove', targetRole);
}

// ==================== AI 角色权限 ====================

interface AiCharacterLike {
  userId: string;
  visibility: string;
}

/**
 * 是否可以修改 AI 角色本体（名称、人设、头像等）
 */
export function canUpdateAiCharacter(userId: string, character: AiCharacterLike): boolean {
  return character.userId === userId;
}

/**
 * 是否可以删除 AI 角色
 */
export function canDeleteAiCharacter(userId: string, character: AiCharacterLike): boolean {
  return character.userId === userId;
}

/**
 * 是否可以修改 AI 角色的用户级参数覆盖
 */
export function canUpdateAiCharacterOverride(userId: string, character: AiCharacterLike): boolean {
  return character.visibility === 'public' || character.userId === userId;
}

// ==================== 会话消息权限 ====================

interface ConversationLike {
  type: string;
}

interface ConversationMemberLike {
  mutedUntil?: Date | null;
  role?: string;
  [key: string]: any;
}

/**
 * 是否可以在会话中发送消息
 */
export function canSendMessage(
  conversation: ConversationLike,
  member?: ConversationMemberLike | null,
): boolean {
  if (conversation.type === 'system') return false;

  // 私聊必须校验成员身份，防止 IDOR 攻击
  // （原实现无条件返回 true，攻击者可向任意 conversationId 的私聊注入伪造消息）
  if (conversation.type === 'private') {
    return !!member;
  }

  if (conversation.type === 'group') {
    if (!member) return false;
    if (member.mutedUntil && new Date(member.mutedUntil) > new Date()) return false;
    return true;
  }

  return false;
}
