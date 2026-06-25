# Biu IM API 参考文档

> 自动生成于 2026-06-21 00:46

---

## 概述

- **Base URL**: `http://localhost:3000`
- **认证方式**: JWT Bearer Token（除注册/登录外均需认证）
- **请求格式**: `application/json`
- **响应格式**: `{ code, message, data }`
- **端点总数**: 59

---

## 目录

- [AI 快捷功能 (/api/ai)](#ai) - 3 个端点
- [AI 角色与模型 (/api/ai-roles)](#ai-role) - 17 个端点
- [认证 (/api/auth)](#auth) - 3 个端点
- [徽章 (/api/badges)](#badge) - 3 个端点
- [会话 (/api/conversations)](#chat) - 15 个端点
- [好友 (/api/friends)](#friend) - 5 个端点
- [消息 (/api/messages)](#message) - 2 个端点
- [通知设置 (/api/notifications)](#notification) - 3 个端点
- [官方管理 (/api/official)](#official) - 6 个端点
- [用户 (/api/users)](#user) - 2 个端点

---

## AI 快捷功能
**Base**: `/api/ai` | AI 快捷消息与查找

### 🔒 `POST` /api/ai/quick-send

**描述**: [AI 快捷功能] 快速发送消息

**控制器**: `controller.quickSend`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/ai/recent

**描述**: [AI 快捷功能] 获取最近会话

**控制器**: `controller.getRecent`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/ai/find-user/:biuId

**描述**: [AI 快捷功能] 查找用户

**控制器**: `controller.findUser`

**认证**: 需要 Bearer Token

**路径参数**:

- `biuId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## AI 角色与模型
**Base**: `/api/ai-roles` | AI 角色配置与对话

### 🔒 `GET` /api/ai-roles/config/model

**描述**: [AI 角色与模型] 获取 AI 配置

**控制器**: `modelConfigController.getConfig`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/ai-roles/config/model

**描述**: [AI 角色与模型] 保存 AI 配置

**控制器**: `modelConfigController.saveConfig`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/config/test

**描述**: [AI 角色与模型] 测试 AI 连接

**控制器**: `modelConfigController.testConfigConnection`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/ai-roles/conversations/:conversationId/messages

**描述**: [AI 角色与模型] 清空会话消息

**控制器**: `controller.clearConversationMessages`

**认证**: 需要 Bearer Token

**路径参数**:

- `conversationId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/conversations/:conversationId/regenerate

**描述**: [AI 角色与模型] 重新生成回复

**控制器**: `controller.regenerateLastReply`

**认证**: 需要 Bearer Token

**路径参数**:

- `conversationId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/ai-roles

**描述**: [AI 角色与模型] 获取 AI 角色列表

**控制器**: `controller.listRoles`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles

**描述**: [AI 角色与模型] 创建 AI 角色

**控制器**: `controller.createRole`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/ai-roles/:id

**描述**: [AI 角色与模型] 获取 AI 角色详情

**控制器**: `controller.getRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/ai-roles/:id

**描述**: [AI 角色与模型] 更新 AI 角色

**控制器**: `controller.updateRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/ai-roles/:id

**描述**: [AI 角色与模型] 删除 AI 角色

**控制器**: `controller.deleteRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/:id/chat

**描述**: [AI 角色与模型] 与 AI 角色对话

**控制器**: `controller.chatWithRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/ai-roles/models

**描述**: [AI 模型管理] 获取模型列表

**控制器**: `controller.listModels`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/models/fetch-remote

**描述**: [AI 模型管理] 从远端获取模型

**控制器**: `controller.fetchRemoteModels`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/models

**描述**: [AI 模型管理] 新增模型

**控制器**: `controller.createModel`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/ai-roles/models/:id

**描述**: [AI 模型管理] 更新模型

**控制器**: `controller.updateModel`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/ai-roles/models/:id

**描述**: [AI 模型管理] 删除模型

**控制器**: `controller.deleteModel`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/ai-roles/models/:id/test

**描述**: [AI 模型管理] 测试模型连接

**控制器**: `controller.testModel`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 认证
**Base**: `/api/auth` | 用户注册、登录与身份认证

### 🔓 `POST` /api/auth/register

**描述**: [认证] 用户注册

**控制器**: `authController.register`

**请求体** (`registerSchema`):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名不能为空 |
| `password` | string | 是 | 密码不能为空 |
| `nickname` | string | 是 | 昵称不能为空 |

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔓 `POST` /api/auth/login

**描述**: [认证] 用户登录

**控制器**: `authController.login`

**请求体** (`loginSchema`):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 账号不能为空 |
| `password` | string | 是 | 密码不能为空 |

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/auth/me

**描述**: [认证] 获取当前用户信息

**控制器**: `authController.me`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 徽章
**Base**: `/api/badges` | 用户徽章系统

### 🔒 `GET` /api/badges

**描述**: [徽章] 获取所有徽章

**控制器**: `badgeController.listBadges`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/badges/user/:userId

**描述**: [徽章] 获取用户徽章

**控制器**: `badgeController.getUserBadges`

**认证**: 需要 Bearer Token

**路径参数**:

- `userId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/badges/assign

**描述**: [徽章] 分配徽章

**控制器**: `badgeController.assignBadge`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 会话
**Base**: `/api/conversations` | 会话创建、成员管理与群组操作

### 🔒 `GET` /api/conversations

**描述**: [会话] 获取列表

**控制器**: `chatController.list`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/conversations

**描述**: [会话] 创建

**控制器**: `chatController.create`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/read-all

**描述**: [会话] 全部标记已读

**控制器**: `chatController.markAllRead`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/conversations/:id

**描述**: [会话] 获取详情

**控制器**: `chatController.detail`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/read

**描述**: [会话] 标记已读

**控制器**: `chatController.markRead`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/conversations/:id

**描述**: [会话] 删除

**控制器**: `chatController.remove`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/conversations/:id/members

**描述**: [会话] 添加成员

**控制器**: `chatController.addMember`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/name

**描述**: [会话] 修改名称

**控制器**: `chatController.updateName`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/nickname

**描述**: [会话] 修改昵称

**控制器**: `chatController.updateNickname`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/announcement

**描述**: [会话] 设置公告

**控制器**: `chatController.setAnnouncement`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/conversations/:id/members

**描述**: [会话] 移除成员

**控制器**: `chatController.removeMember`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/conversations/:id/leave

**描述**: [会话] 退出群聊

**控制器**: `chatController.leaveGroup`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/conversations/:id/dissolve

**描述**: [会话] 解散群聊

**控制器**: `chatController.dissolveGroup`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/role

**描述**: [会话] 设置角色

**控制器**: `chatController.setRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/conversations/:id/transfer-owner

**描述**: [会话] 转让群主

**控制器**: `chatController.transferOwner`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 好友
**Base**: `/api/friends` | 好友请求、管理与列表

### 🔒 `POST` /api/friends/request

**描述**: [好友] 发送好友请求

**控制器**: `friendController.sendRequest`

**认证**: 需要 Bearer Token

**请求体** (`sendFriendRequestSchema`):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `toUserId` | string | 是 | - |
| `message` | string | 否 | - |

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/friends/request/:id

**描述**: [好友] 处理好友请求

**控制器**: `friendController.handleRequest`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**请求体** (`handleFriendRequestSchema`):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | - |

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/friends/:friendId

**描述**: [好友] 删除好友

**控制器**: `friendController.deleteFriend`

**认证**: 需要 Bearer Token

**路径参数**:

- `friendId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/friends/requests

**描述**: [好友] 获取好友请求列表

**控制器**: `friendController.listRequests`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `GET` /api/friends

**描述**: [好友] 获取好友列表

**控制器**: `friendController.listFriends`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 消息
**Base**: `/api/messages` | 消息发送与历史查询

### 🔒 `GET` /api/messages/:conversationId

**描述**: [消息] 获取列表

**控制器**: `messageController.list`

**认证**: 需要 Bearer Token

**路径参数**:

- `conversationId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/messages/:conversationId

**描述**: [消息] 创建

**控制器**: `messageController.create`

**认证**: 需要 Bearer Token

**路径参数**:

- `conversationId` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 通知设置
**Base**: `/api/notifications` | 消息通知偏好设置

### 🔒 `GET` /api/notifications

**描述**: [通知设置] 获取列表

**控制器**: `notificationController.list`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/notifications

**描述**: [通知设置] 创建或更新

**控制器**: `notificationController.upsert`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/notifications/:id

**描述**: [通知设置] 删除

**控制器**: `notificationController.remove`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 官方管理
**Base**: `/api/official` | 管理员功能：用户管理、频道、广播

### 🔒 `GET` /api/official/users

**描述**: [官方管理] 获取所有用户

**控制器**: `controller.getAllUsers`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `DELETE` /api/official/users/:id

**描述**: [官方管理] 删除用户

**控制器**: `controller.deleteUser`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/official/channels

**描述**: [官方管理] 创建官方频道

**控制器**: `controller.createOfficialChannel`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `POST` /api/official/broadcast

**描述**: [官方管理] 发送广播

**控制器**: `controller.sendBroadcast`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/official/users/:id/role

**描述**: [官方管理] 设置用户角色

**控制器**: `controller.setUserRole`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/official/users/:id/official-status

**描述**: [官方管理] 设置官方认证状态

**控制器**: `controller.setUserOfficialStatus`

**认证**: 需要 Bearer Token

**路径参数**:

- `id` (string, required)

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 用户
**Base**: `/api/users` | 用户搜索与个人资料管理

### 🔒 `GET` /api/users/search

**描述**: [用户] 搜索用户

**控制器**: `userController.search`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

### 🔒 `PUT` /api/users/profile

**描述**: [用户] 更新个人资料

**控制器**: `userController.updateProfile`

**认证**: 需要 Bearer Token

**成功响应** (`200`):
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**:

- `401` — 未认证或 Token 无效
- `422` — 输入校验失败
- `500` — 服务器内部错误

---

## 附录: 数据模型

### 请求体 Schema

#### `handleFriendRequestSchema`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | - |

#### `loginSchema`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 账号不能为空 |
| `password` | string | 是 | 密码不能为空 |

#### `registerSchema`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名不能为空 |
| `password` | string | 是 | 密码不能为空 |
| `nickname` | string | 是 | 昵称不能为空 |

#### `sendFriendRequestSchema`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `toUserId` | string | 是 | - |
| `message` | string | 否 | - |

### 共享类型 (shared/types)

```typescript
export interface User {
  id: string;
  biuId: string;
  username: string;
  nickname: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  isSystem?: boolean;
  role: 'user' | 'admin' | 'super_admin';
  officialStatus?: 'none' | 'verified';
  badges?: Badge[];
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  type: string;
  label: string;
  icon: string | null;
  color: string | null;
  description?: string;
}

export interface Conversation {
  id: string;
  biuId?: string;
  type: 'private' | 'group';
  name: string | null;
  creatorId: string;
  ownerId?: string;
  announcement?: string | null;
  createdAt: string;
  members: ConversationMember[];
  lastMessage?: LastMessage | null;
  unreadCount?: number;
  mentionType?: 'me' | 'all' | null;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  nickname?: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user?: User & { isSystem?: boolean };
}

export interface LastMessage {
  id: string;
  content: string;
  senderId: string;
  senderNickname?: string;
  createdAt: string;
  mentions?: string[] | null;
  mentionsAll?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card' | 'system';
  cardType?: string | null;
  cardData?: CardData | SystemCardData | null;
  mentions?: string[] | null;
  mentionsAll?: boolean;
  createdAt: string;
  sender?: User;
}

export interface CardData {
  title?: string;
  body?: string;
  link?: string;
  reasoning?: string;
}

export type SystemAction =
  | 'group_create'
  | 'group_join'
  | 'group_leave'
  | 'group_remove'
  | 'group_rename'
  | 'group_announcement'
  | 'group_nickname'
  | 'group_role'
  | 'group_transfer'
  | 'group_dissolve'
  | 'message_recall';

export interface SystemCardData {
  action: SystemAction;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  oldValue?: string;
  newValue?: string;
}

export type StreamEventType = 'start' | 'content' | 'reasoning' | 'done' | 'error';

export interface StreamEvent {
  conversationId: string;
  type: StreamEventType;
  delta?: string;
  aiUserId?: string;
  reasoning?: string;
  content?: string;
  message?: string;
}

export interface ConversationRead {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: string;
  mentioned: boolean;
  mentionedAll: boolean;
}

export interface ChatSendMessage {
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card';
}

export interface ChatReceiveMessage extends Message {
  sender: User;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  account: string;
  password: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string | null;
  createdAt: string;
  fromUser?: User;
  toUser?: User;
}
```
