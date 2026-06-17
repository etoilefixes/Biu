# Biu - Code Wiki

## 1. 项目概览

**Biu** 是一个全栈即时通讯应用，支持私聊、群聊、好友系统、AI 工作台、官方管理后台等功能。项目采用 Monorepo 架构，分为三个工作区：`shared`（共享类型）、`server`（后端服务）、`client`（前端 + Electron 桌面端）。

| 维度 | 说明 |
|------|------|
| 项目名称 | Biu |
| 架构模式 | Monorepo (npm workspaces) |
| 前端框架 | React 18 + TypeScript + Vite |
| 桌面端 | Electron 33 |
| 后端框架 | Express 4 + TypeScript |
| 数据库 | PostgreSQL (Prisma ORM) |
| 缓存 | Redis |
| 实时通信 | Socket.IO (WebSocket) |
| 状态管理 | Zustand |
| UI 样式 | Tailwind CSS + 自定义 Glass 主题 |
| 校验 | Zod (后端) |
| 认证 | JWT (Bearer Token) |

---

## 2. 项目目录结构

```
d:\Biu
├── shared/                    # 共享类型定义（前后端共用）
│   ├── types/index.ts         # TypeScript 接口定义
│   └── package.json
├── server/                    # 后端服务
│   ├── prisma/                # 数据库相关
│   │   ├── schema.prisma      # Prisma 数据模型
│   │   ├── seed.ts            # 种子数据（系统用户 + 徽章）
│   │   ├── migrations/        # 数据库迁移
│   │   ├── create-ai-account.ts
│   │   ├── create-official-account.ts
│   │   └── fix-owner-roles.ts
│   ├── src/
│   │   ├── app.ts             # 应用入口
│   │   ├── config/            # 配置（数据库、Redis、环境变量）
│   │   ├── middleware/        # 中间件（认证、错误处理、校验）
│   │   ├── modules/           # 业务模块（每个模块含 controller/service/routes/schema）
│   │   │   ├── auth/          # 认证模块
│   │   │   ├── chat/          # 会话模块
│   │   │   ├── message/       # 消息模块
│   │   │   ├── friend/        # 好友模块
│   │   │   ├── user/          # 用户模块
│   │   │   ├── badge/         # 徽章模块
│   │   │   ├── official/      # 官方管理模块
│   │   │   └── ai/            # AI 模块
│   │   ├── socket/            # WebSocket 处理器
│   │   └── utils/             # 工具函数（BiuId 生成）
│   ├── .env.example
│   └── package.json
├── client/                    # 前端 + Electron
│   ├── electron/              # Electron 主进程 + 预加载
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── main/                  # 编译后的 Electron 主进程文件
│   ├── src/
│   │   ├── main.tsx           # React 入口
│   │   ├── App.tsx            # 路由配置
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 通用组件
│   │   ├── layouts/           # 布局组件
│   │   ├── store/             # Zustand 状态管理
│   │   ├── services/          # API 与 Socket 服务
│   │   ├── utils/             # 工具函数
│   │   ├── assets/            # 静态资源（徽章 SVG）
│   │   ├── styles/            # 全局样式
│   │   └── types/             # 类型声明
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.electron.json
│   ├── postcss.config.js
│   ├── launcher.py            # Python 启动器（自动登录）
│   └── package.json
├── docs/                      # 文档
├── screenshots/               # 截图
└── package.json               # Monorepo 根配置
```

---

## 3. 架构设计

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────┐
│                    Electron Shell                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │              React SPA (Vite Dev)                │ │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────────────┐ │ │
│  │  │  Pages   │ │  Store  │ │   Services        │ │ │
│  │  │ (路由页面)│ │(Zustand)│ │ (API + Socket.IO) │ │ │
│  │  └────┬─────┘ └────┬────┘ └────────┬──────────┘ │ │
│  └───────┼─────────────┼───────────────┼────────────┘ │
│          │             │               │              │
│  ┌───────┴─────────────┴───────────────┴────────────┐ │
│  │              @biu/shared (类型定义)                │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌──────────────────────────────────────────────────────┐
│                 Express + Socket.IO                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Middleware│ │  Routes  │ │  Socket   │             │
│  │(auth/val)│ │(REST API)│ │ Handlers  │             │
│  └────┬─────┘ └────┬─────┘ └────┬──────┘             │
│       │            │            │                     │
│  ┌────┴────────────┴────────────┴──────┐             │
│  │           Services (业务逻辑)        │             │
│  └────────────────┬────────────────────┘             │
│                   │                                   │
│  ┌────────────────┴────────────────────┐             │
│  │         Prisma ORM + Redis          │             │
│  └───────────┬────────────┬────────────┘             │
│              │            │                           │
│         PostgreSQL      Redis                        │
└──────────────────────────────────────────────────────┘
```

### 3.2 通信模式

| 通信方式 | 用途 | 协议 |
|---------|------|------|
| REST API | CRUD 操作（认证、会话管理、好友、消息查询等） | HTTP + JSON |
| WebSocket | 实时消息推送、打字状态、在线状态、未读计数 | Socket.IO |

### 3.3 认证流程

1. 用户通过 `/api/auth/login` 或 `/api/auth/register` 获取 JWT Token
2. 前端将 Token 存储在 `localStorage`，通过 Axios 拦截器自动附加到请求头 `Authorization: Bearer <token>`
3. WebSocket 连接时通过 `auth.token` 传递 JWT 进行认证
4. 后端 `authMiddleware` 中间件校验 Token 并将 `userId` 注入 `Request` 对象

---

## 4. 数据模型

### 4.1 ER 关系图

```
User ──1:N── ConversationMember ──N:1── Conversation
 │                                        │
 │────────1:N── Message                   │
 │                                        │
 │────────1:N── ConversationRead          │
 │                                        │
 │────────1:N── UserBadge ──N:1── Badge   │
 │
 │────────1:N── FriendRequest (sent/received)
```

### 4.2 核心模型说明

| 模型 | 说明 | 关键字段 |
|------|------|---------|
| **User** | 用户 | `biuId`（唯一编号如 `100001Biu`）、`username`、`nickname`、`role`（user/admin/official）、`isSystem` |
| **Conversation** | 会话 | `biuId`（会话编号）、`type`（private/group）、`ownerId`、`announcement` |
| **ConversationMember** | 会话成员 | `userId`、`conversationId`、`role`（owner/admin/member）、`nickname`（群昵称） |
| **Message** | 消息 | `content`、`type`（text/image/file/card）、`cardType`、`cardData`、`mentions`、`mentionsAll` |
| **ConversationRead** | 已读记录 | `lastReadAt`、`mentioned`、`mentionedAll`（联合唯一：conversationId + userId） |
| **Badge** | 徽章定义 | `type`（OFFICIAL/AI/SYSTEM/VERIFIED/BOT/ENTERPRISE）、`label`、`icon`、`color` |
| **UserBadge** | 用户徽章关联 | `userId` + `badgeId`（联合唯一） |
| **FriendRequest** | 好友请求 | `fromUserId`、`toUserId`、`status`（pending/accepted/rejected） |

### 4.3 特殊用户

- **系统用户**：`id='system'`，`biuId='SYSTEM_Biu'`，`isSystem=true`，用于系统通知和欢迎消息
- **AI 用户**：通过 `prisma/create-ai-account.ts` 创建，拥有 `AI` 徽章
- **官方用户**：通过 `prisma/create-official-account.ts` 创建，拥有 `OFFICIAL` 徽章，可访问管理后台

---

## 5. 后端模块详解

### 5.1 应用入口 — `server/src/app.ts`

- 创建 Express 应用和 HTTP Server
- 初始化 Socket.IO 并绑定到 HTTP Server
- 注册所有路由模块到 `/api/*` 前缀
- 连接 Redis 和 PostgreSQL 后启动服务
- 错误处理中间件放在最后

### 5.2 配置层 — `server/src/config/`

| 文件 | 职责 |
|------|------|
| `index.ts` | 读取环境变量（PORT、JWT_SECRET、DATABASE_URL、REDIS_URL） |
| `database.ts` | 导出 PrismaClient 单例 `prisma`，开发环境开启 query 日志 |
| `redis.ts` | 导出 Redis 客户端单例 `redis` 和 `connectRedis()` 连接函数 |

### 5.3 中间件层 — `server/src/middleware/`

| 文件 | 职责 | 关键函数 |
|------|------|---------|
| `auth.ts` | JWT 认证 | `authMiddleware(req, res, next)` — 从 `Authorization: Bearer` 提取并验证 Token，将 `userId` 注入 `req` |
| `validate.ts` | 请求体校验 | `validate(schema)` — 接受 Zod Schema，校验 `req.body`，失败返回 422 |
| `errorHandler.ts` | 全局错误处理 | `errorHandler(err, req, res, next)` — 捕获未处理错误，返回 500 |

### 5.4 业务模块

每个模块遵循 **Controller → Service → Prisma** 三层架构：

```
模块目录/
├── *.routes.ts      # 路由定义（URL → Controller 方法映射）
├── *.controller.ts  # 控制器（请求/响应处理，调用 Service）
├── *.service.ts     # 服务层（业务逻辑，调用 Prisma/Redis）
└── *.schema.ts      # Zod 校验 Schema（可选）
```

#### 5.4.1 Auth 模块 — `server/src/modules/auth/`

| 函数 | 说明 |
|------|------|
| `register(data)` | 注册用户：生成 BiuId → 哈希密码 → 事务创建用户 + 系统好友关系 + 欢迎会话 + 欢迎消息 → 签发 JWT。支持 P2002 唯一约束冲突重试（最多 3 次） |
| `login(data)` | 登录：支持用户名或 BiuId 登录 → bcrypt 验证密码 → 签发 JWT |
| `getMe(userId)` | 获取当前用户信息（含徽章） |
| `generateUserBiuId(tx?)` | 生成用户 BiuId（格式：`100001Biu`，递增编号，排除系统用户） |
| `RegisterError` | 自定义错误类，携带 HTTP 状态码 |

**路由**：
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 否 |
| POST | `/api/auth/login` | 登录 | 否 |
| GET | `/api/auth/me` | 获取当前用户 | 是 |

#### 5.4.2 Chat 模块 — `server/src/modules/chat/`

| 函数 | 说明 |
|------|------|
| `getConversations(userId)` | 获取用户所有会话（含最后一条消息、未读数、@提及状态），按最后消息时间排序 |
| `createConversation(userId, data)` | 创建会话（私聊自动去重，群聊生成 GroupBiuId） |
| `getConversationDetail(id, userId)` | 获取会话详情（含成员列表） |
| `markAsRead(userId, conversationId)` | 标记已读（更新 Redis + DB） |
| `markAllAsRead(userId)` | 全部标记已读 |
| `deleteConversation(userId, conversationId)` | 删除会话（系统会话不可删，最后一人退出时清理数据） |
| `updateGroupName(userId, conversationId, name)` | 修改群名称（需管理员/群主权限） |
| `updateMemberNickname(userId, conversationId, nickname)` | 修改群昵称 |
| `setAnnouncement(userId, conversationId, announcement)` | 设置群公告（需管理员/群主权限） |
| `addMemberToConversation(userId, conversationId, memberUserId)` | 添加群成员 |
| `removeMember(userId, conversationId, memberId)` | 移除群成员（需管理员/群主权限） |
| `leaveGroup(userId, conversationId)` | 退出群聊（群主退出自动转让） |
| `dissolveGroup(userId, conversationId)` | 解散群聊（仅群主） |
| `setMemberRole(userId, conversationId, memberId, role)` | 设置成员角色（仅群主） |
| `transferOwnership(userId, conversationId, newOwnerUserId)` | 转让群主（仅群主） |

**路由**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conversations` | 会话列表 |
| POST | `/api/conversations` | 创建会话 |
| PUT | `/api/conversations/read-all` | 全部已读 |
| GET | `/api/conversations/:id` | 会话详情 |
| PUT | `/api/conversations/:id/read` | 标记已读 |
| DELETE | `/api/conversations/:id` | 删除会话 |
| POST | `/api/conversations/:id/members` | 添加成员 |
| PUT | `/api/conversations/:id/name` | 修改群名 |
| PUT | `/api/conversations/:id/nickname` | 修改群昵称 |
| PUT | `/api/conversations/:id/announcement` | 设置群公告 |
| DELETE | `/api/conversations/:id/members` | 移除成员 |
| POST | `/api/conversations/:id/leave` | 退出群聊 |
| DELETE | `/api/conversations/:id/dissolve` | 解散群聊 |
| PUT | `/api/conversations/:id/role` | 设置成员角色 |
| PUT | `/api/conversations/:id/transfer-owner` | 转让群主 |

#### 5.4.3 Message 模块 — `server/src/modules/message/`

| 函数 | 说明 |
|------|------|
| `getMessages(conversationId, userId, before?, limit?)` | 获取消息列表（分页，含 `lastReadAt` 用于前端定位新消息分隔线） |
| `createMessage(conversationId, senderId, content, type, cardType?, cardData?)` | 创建消息：权限校验 → 解析 @提及 → 写入消息 → 更新 ConversationRead 提及状态 |

**@提及协议**：消息内容中使用 `[at:userId]` 表示 @某人，`[at:all]` 表示 @全体成员。

**路由**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/messages/:conversationId` | 获取消息列表 |
| POST | `/api/messages/:conversationId` | 发送消息 |

#### 5.4.4 Friend 模块 — `server/src/modules/friend/`

| 函数 | 说明 |
|------|------|
| `sendFriendRequest(fromUserId, toUserId, message?)` | 发送好友请求（去重校验 → 创建请求 → Socket 实时通知对方） |
| `handleFriendRequest(userId, requestId, action)` | 处理好友请求（accept 时自动创建私聊会话 + 好友欢迎卡片消息） |
| `getFriendRequests(userId)` | 获取收到/发出的好友请求 |
| `getFriends(userId)` | 获取好友列表（排除系统用户） |
| `deleteFriend(userId, friendId)` | 删除好友（不可删系统账号） |

**路由**：
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/friends/request` | 发送好友请求 |
| PUT | `/api/friends/request/:id` | 处理好友请求 |
| DELETE | `/api/friends/:friendId` | 删除好友 |
| GET | `/api/friends/requests` | 好友请求列表 |
| GET | `/api/friends` | 好友列表 |

#### 5.4.5 User 模块 — `server/src/modules/user/`

| 函数 | 说明 |
|------|------|
| `searchUsers(keyword, currentUserId)` | 搜索用户（按用户名/昵称/BiuId 模糊匹配，排除自己） |
| `updateProfile(userId, data)` | 更新个人资料（昵称、头像） |

#### 5.4.6 Badge 模块 — `server/src/modules/badge/`

| 函数 | 说明 |
|------|------|
| `listBadges()` | 列出所有徽章 |
| `getUserBadges(userId)` | 获取用户徽章 |
| `assignBadge(userId, badgeType)` | 分配徽章给用户 |

#### 5.4.7 Official 模块 — `server/src/modules/official/`

| 函数 | 说明 |
|------|------|
| `getAllUsers(officialUserId)` | 获取所有用户（需 official/admin 角色） |
| `deleteUser(officialUserId, targetUserId)` | 删除用户 |
| `createOfficialChannel(officialUserId, data)` | 创建官方群频道 |
| `sendBroadcast(officialUserId, data)` | 向所有用户发送广播（为每个用户创建独立私聊 + 卡片消息） |
| `setUserRole(officialUserId, targetUserId, role)` | 设置用户角色（自动分配/移除官方徽章） |

#### 5.4.8 AI 模块 — `server/src/modules/ai/`

| 函数 | 说明 |
|------|------|
| `quickSendMessage(userId, targetUserId, content)` | 快速发消息（自动创建/复用私聊会话） |
| `getRecentConversations(userId, limit?)` | 获取最近会话 |
| `findUserByBiuId(biuId)` | 通过 BiuId 查找用户 |

### 5.5 WebSocket 层 — `server/src/socket/`

| 文件 | 职责 |
|------|------|
| `index.ts` | `setupSocket(server)` — Socket.IO 初始化：JWT 认证 → Redis 存储在线状态 → 注册事件处理器 |
| `chat.handler.ts` | `registerChatHandlers(io, socket)` — 处理聊天事件 |
| `user.handler.ts` | `registerUserHandlers(io, socket)` — 处理用户事件 |

**Socket 事件**：

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `chat:send` | Client → Server | 发送消息 |
| `chat:ack` | Server → Client | 消息发送确认 |
| `chat:message` | Server → Client | 接收新消息 |
| `chat:error` | Server → Client | 消息发送失败 |
| `chat:typing` | 双向 | 打字状态 |
| `chat:mark-read` | Client → Server | 标记已读 |
| `chat:unread` | Server → Client | 未读数更新 |
| `user:online` | Server → All | 用户上线 |
| `user:offline` | Server → All | 用户下线 |
| `user:heartbeat` | Client → Server | 心跳（60s 间隔，Redis 5min 过期） |
| `friend:request` | 双向 | 好友请求通知 |

**Redis 键设计**：

| Key 模式 | 说明 | TTL |
|----------|------|-----|
| `user:socket:{userId}` | 用户 Socket 连接 ID | 无 |
| `user:status:{userId}` | 用户在线状态 | 无 |
| `user:online:{userId}` | 心跳在线标记 | 300s |
| `unread:{userId}:{conversationId}` | 未读消息数 | 无 |
| `read:{userId}:{conversationId}` | 已读时间戳（ISO） | 无 |

### 5.6 工具函数 — `server/src/utils/biuId.ts`

| 函数 | 说明 |
|------|------|
| `generateConversationBiuId()` | 生成会话 BiuId（8 位随机数字） |
| `generateGroupBiuId()` | 生成群组 BiuId（2 开头 + 7 位随机数字，如 `21234567`） |

---

## 6. 前端模块详解

### 6.1 路由结构 — `client/src/App.tsx`

| 路径 | 组件 | 布局 | 认证 |
|------|------|------|------|
| `/login` | LoginPage | 无 | 否 |
| `/register` | RegisterPage | 无 | 否 |
| `/chat` | ChatPage | AppLayout | 是 |
| `/contacts` | ContactsPage | AppLayout | 是 |
| `/profile` | ProfilePage | AppLayout | 是 |
| `/admin` | AdminPage | AppLayout | 是 |
| `/ai-chat` | AIChatPage | AILayout | 是（需 AI 徽章） |
| `*` | 重定向 | — | — |

- `PrivateRoute`：未认证用户重定向到 `/login`
- AI 用户（`username='biu_ai'` 或拥有 `AI` 徽章）默认重定向到 `/ai-chat`
- 普通用户默认重定向到 `/chat`

### 6.2 状态管理 — `client/src/store/`

#### 6.2.1 authStore — 认证状态

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `user` | `User \| null` | 当前用户 |
| `token` | `string \| null` | JWT Token（持久化到 localStorage） |
| `isAuthenticated` | `boolean` | 是否已认证 |
| `login(account, password)` | action | 登录 → 存储 Token → 连接 Socket |
| `register(username, password, nickname)` | action | 注册 → 存储 Token → 连接 Socket |
| `logout()` | action | 清除 Token → 断开 Socket → 清空其他 Store |
| `loadUser()` | action | 从 `/auth/me` 加载用户信息 |
| `updateProfileOptimistic(data)` | action | 乐观更新个人资料（先更新 UI，再发请求，失败回滚） |

#### 6.2.2 chatStore — 聊天状态

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `conversations` | `Conversation[]` | 会话列表（按最后消息排序） |
| `currentConversation` | `Conversation \| null` | 当前选中会话 |
| `messages` | `Message[]` | 当前会话消息列表 |
| `typingUsers` | `Map<string, string>` | 打字状态（conversationId → userId） |
| `unreadMap` | `{[convId]: number}` | 未读消息映射 |
| `totalUnread` | `number` | 总未读数 |
| `lastReadMessageId` | `string \| null` | 新消息分隔线锚点 |
| `loadConversations()` | action | 加载会话列表 |
| `selectConversation(conv)` | action | 选中会话 → 加载消息 → 标记已读 |
| `sendMessage(content, type, senderId)` | action | 发送消息（乐观更新 + ACK 超时重试机制） |
| `addMessage(message)` | action | 添加收到的消息（匹配乐观更新的临时消息） |
| `deleteConversation(convId)` | action | 删除会话 |
| `markAllRead()` | action | 全部标记已读 |

**消息发送机制**：
1. 生成临时 ID（`temp_{timestamp}_{counter}`），立即添加到消息列表（乐观更新，`_status='sending'`）
2. 通过 Socket 发送 `chat:send`
3. 等待 `chat:ack` 确认，超时 10s 后重试 1 次
4. 收到 `chat:message` 时匹配临时消息并替换
5. 超时未确认则标记为 `_status='failed'`，用户可点击重试
6. `cleanupStaleSending()` 清理超过 30s 仍在 sending 的消息

#### 6.2.3 friendStore — 好友状态

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `friends` | `User[]` | 好友列表 |
| `receivedRequests` | `FriendRequest[]` | 收到的好友请求 |
| `sentRequests` | `FriendRequest[]` | 发出的好友请求 |
| `pendingRequestCount` | `number` | 待处理请求数 |

### 6.3 服务层 — `client/src/services/`

#### 6.3.1 api.ts — HTTP 客户端

- 基于 Axios，baseURL = `http://localhost:3001/api`
- 请求拦截器：自动附加 `Authorization: Bearer <token>`
- 响应拦截器：自动解包 `response.data`，统一错误处理

#### 6.3.2 socket.ts — WebSocket 服务

- 封装为 `SocketService` 单例类
- `connect(token)`：建立 WebSocket 连接，启动 60s 心跳
- 事件监听方法：`onMessage`、`onTyping`、`onUnread`、`onUserOnline`、`onUserOffline`、`onFriendRequest`、`onChatError`、`onChatAck`
- 发送方法：`sendMessage`、`sendTyping`、`markRead`

### 6.4 页面组件 — `client/src/pages/`

| 组件 | 说明 | 核心功能 |
|------|------|---------|
| **LoginPage** | 登录页 | 用户名/BiuId + 密码登录 |
| **RegisterPage** | 注册页 | 用户名 + 昵称 + 密码注册（前端校验 + 后端 Zod 校验） |
| **ChatPage** | 聊天主页 | 会话列表（可拖拽调整宽度）+ 消息区 + 输入框（支持 @提及、Emoji、Markdown 渲染）+ 创建群聊/添加好友/群管理 |
| **ContactsPage** | 联系人页 | 好友列表 + 好友请求 + 搜索用户 + 用户资料弹窗 |
| **ProfilePage** | 个人资料页 | 查看/编辑昵称 + 退出登录 |
| **AdminPage** | 管理后台 | 用户统计 + 系统广播 + 用户管理（角色设置/删除），需 official/admin 角色 |
| **AIChatPage** | AI 工作台 | 简化版聊天界面，需 AI 徽章 |

### 6.5 通用组件 — `client/src/components/`

| 组件 | 说明 |
|------|------|
| **NavBar** | 左侧导航栏：头像（点击弹出资料卡）、消息/联系人导航、AI 工作台入口（条件显示）、管理面板入口（条件显示）、设置面板 |
| **TitleBar** | 自定义标题栏（Electron 无边框窗口）：最小化/最大化/关闭 |
| **ChatBubble** | 消息气泡：文本消息（Markdown + @提及渲染）、卡片消息（welcome/friend_welcome/notification/broadcast）、右键菜单（复制/删除）、发送状态指示 |
| **ConversationItem** | 会话列表项：头像+徽章、名称、消息预览、未读数、@提及提示、滑动删除 |
| **AvatarWithBadge** | 带徽章的头像：系统用户显示 Biu Logo，普通用户显示首字母/图片，右下角显示主徽章 SVG |
| **UserBadge** | 用户徽章行内显示：渲染徽章 SVG 图标列表 |
| **EmojiPicker** | Emoji 选择器：基于 emoji-mart |
| **GlassCard** | 毛玻璃卡片容器 |
| **Toast** | 轻提示组件 |
| **ErrorBoundary** | 错误边界 |
| **TimeSeparator** | 时间分隔线 |
| **NewMessageDivider** | 新消息分隔线 |
| **Icons** | SVG 图标集合 |

### 6.6 布局组件 — `client/src/layouts/`

| 组件 | 说明 |
|------|------|
| **AppLayout** | 主布局：TitleBar + NavBar + Outlet，自动加载好友请求并监听 Socket |
| **AILayout** | AI 布局：全屏 Outlet，校验 AI 徽章权限，无权限重定向到 `/chat` |

### 6.7 工具函数 — `client/src/utils/`

| 文件 | 函数 | 说明 |
|------|------|------|
| `time.ts` | `formatSeparatorLabel(date)` | 智能时间格式化（今天/昨天/本周/本年/更早） |
| | `formatExactTime(date)` | 精确时间（悬停 tooltip） |
| | `shouldShowSeparator(current, previous, gapMs?)` | 判断是否需要时间分隔线（默认 5 分钟间隔） |
| `mention.tsx` | `renderPreview(text)` | 将 `[at:userId]` 替换为纯文本 `@显示名`（用于会话列表预览） |
| | `renderRich(content)` | 将 `[at:userId]` 替换为红色高亮 JSX 节点（用于聊天气泡） |
| `emoji.tsx` | `emojiToCodePoint(emoji)` | Emoji 转 Unicode 码点 |
| | `getEmojiSvgUrl(emoji)` | 获取 OpenMoji CDN SVG URL |
| | `renderContentWithEmoji(content)` | 将文本中的 Emoji 替换为 SVG 图片 |

### 6.8 Electron 层 — `client/electron/`

| 文件 | 说明 |
|------|------|
| `main.ts` | Electron 主进程：无边框窗口（1200×800）、IPC 通信（窗口控制、标题设置）、开发/生产环境 URL 切换 |
| `preload.ts` | 预加载脚本：通过 `contextBridge` 暴露 `electronAPI`（平台信息、自动登录 Token、窗口控制方法） |

**electronAPI 接口**：
| 方法 | 说明 |
|------|------|
| `platform` | 操作系统平台 |
| `autoLoginToken` | 启动器注入的自动登录 Token |
| `setTitle(title)` | 设置窗口标题 |
| `minimize()` | 最小化 |
| `maximize()` | 最大化/还原 |
| `close()` | 关闭 |
| `isMaximized()` | 查询是否最大化 |
| `onMaximizedChanged(cb)` | 监听最大化状态变化 |

---

## 7. 共享类型 — `shared/types/index.ts`

前后端共用的 TypeScript 接口定义：

| 接口 | 说明 |
|------|------|
| `User` | 用户（id, biuId, username, nickname, avatar, status, role, badges） |
| `Badge` | 徽章（type, label, icon, color, description） |
| `Conversation` | 会话（id, biuId, type, name, members, lastMessage, unreadCount, mentionType） |
| `ConversationMember` | 会话成员（userId, nickname, role, user） |
| `LastMessage` | 最后一条消息摘要 |
| `Message` | 消息（content, type, cardType, cardData, mentions, mentionsAll, sender） |
| `ConversationRead` | 已读记录 |
| `ChatSendMessage` | 发送消息请求 |
| `ChatReceiveMessage` | 接收消息（含 sender） |
| `AuthResponse` | 认证响应（token + user） |
| `RegisterRequest` | 注册请求 |
| `LoginRequest` | 登录请求 |
| `ApiResponse<T>` | 统一 API 响应格式 |
| `ApiError` | API 错误格式 |
| `FriendRequest` | 好友请求 |

---

## 8. 依赖关系

### 8.1 后端依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `express` | ^4.21 | Web 框架 |
| `socket.io` | ^4.8 | WebSocket 服务 |
| `@prisma/client` | ^5.22 | ORM（PostgreSQL） |
| `redis` | ^4.7 | Redis 客户端 |
| `bcrypt` | ^5.1 | 密码哈希 |
| `jsonwebtoken` | ^9.0 | JWT 签发/验证 |
| `zod` | ^3.23 | 请求体校验 |
| `cors` | ^2.8 | CORS 中间件 |
| `dotenv` | ^16.4 | 环境变量 |

### 8.2 前端依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `react` | ^18.3 | UI 框架 |
| `react-dom` | ^18.3 | React DOM 渲染 |
| `react-router-dom` | ^6.28 | 路由 |
| `zustand` | ^5.0 | 状态管理 |
| `axios` | ^1.7 | HTTP 客户端 |
| `socket.io-client` | ^4.8 | WebSocket 客户端 |
| `framer-motion` | ^12.40 | 动画 |
| `react-markdown` | ^10.1 | Markdown 渲染 |
| `remark-gfm` | ^4.0 | GFM 扩展 |
| `emoji-mart` | ^5.6 | Emoji 选择器 |
| `tailwindcss` | ^3.4 | CSS 框架 |
| `electron` | ^33.0 | 桌面端 |

### 8.3 内部依赖

```
@biu/shared  ←  @biu/server  （后端引用共享类型）
@biu/shared  ←  @biu/client  （前端引用共享类型，通过 Vite alias）
```

---

## 9. 项目运行方式

### 9.1 环境要求

- Node.js（推荐 18+）
- PostgreSQL
- Redis
- Python（可选，用于 launcher.py）

### 9.2 环境变量

复制 `server/.env.example` 为 `server/.env` 并配置：

```env
DATABASE_URL=postgresql://postgres:123456@localhost:5432/biu
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
```

### 9.3 启动步骤

```bash
# 1. 安装依赖（Monorepo 根目录）
npm install

# 2. 初始化数据库
cd server
npx prisma migrate dev    # 运行迁移
npx prisma db seed        # 种子数据（创建系统用户 + 徽章）

# 3. 创建特殊账号（可选）
npm run create-official   # 创建官方账号
npm run create-ai         # 创建 AI 账号

# 4. 启动后端
npm run dev               # tsx watch 热重载，监听 3000 端口

# 5. 启动前端（新终端）
cd ../client
npm run dev               # Vite 开发服务器，监听 5173 端口

# 6. 启动 Electron 桌面端（可选）
npm run electron:dev      # 同时启动 Vite + Electron
```

### 9.4 NPM Scripts 速查

**根目录**：
| 命令 | 说明 |
|------|------|
| `npm install` | 安装所有工作区依赖 |

**server**：
| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（tsx watch） |
| `npm run build` | 编译 TypeScript |
| `npm run start` | 运行编译后的代码 |
| `npm run db:migrate` | 运行数据库迁移 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送 Schema 到数据库 |
| `npm run create-official` | 创建官方账号 |
| `npm run create-ai` | 创建 AI 账号 |

**client**：
| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端 |
| `npm run electron:dev` | 启动 Electron 开发模式 |
| `npm run electron:dev:1` | 启动 Electron 实例 1（独立用户数据） |
| `npm run electron:dev:2` | 启动 Electron 实例 2（独立用户数据） |
| `npm run electron:build` | 构建 Electron 应用 |

---

## 10. API 响应格式

所有 API 统一返回以下格式：

**成功响应**：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": { ... }
}
```

**错误响应**：
```json
{
  "code": 401,
  "message": "令牌无效或已过期"
}
```

**常见状态码**：
| code | 说明 |
|------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证/Token 无效 |
| 403 | 无权访问 |
| 404 | 资源不存在 |
| 409 | 冲突（如用户名已存在） |
| 422 | 输入校验失败（Zod） |
| 500 | 服务器内部错误 |

---

## 11. 关键设计决策

### 11.1 BiuId 编号体系

- **用户 BiuId**：`100001Biu` 格式，递增编号，排除系统用户
- **会话 BiuId**：8 位随机数字
- **群组 BiuId**：`2` 开头 + 7 位随机数字，与用户 BiuId 命名空间隔离

### 11.2 未读消息机制

采用 **Redis + DB 双写** 策略：
- Redis 存储实时未读数（`unread:{userId}:{convId}`）和已读时间戳（`read:{userId}:{convId}`）
- DB 存储 `ConversationRead` 记录（持久化，Redis 重启后可回退查询）
- 前端打开会话时先获取消息（含 `lastReadAt`），再标记已读

### 11.3 乐观更新策略

- 消息发送：立即在 UI 显示临时消息，收到服务端确认后替换
- 个人资料修改：先更新 UI，请求失败则回滚
- 会话创建：先添加临时会话，服务端返回后替换

### 11.4 系统用户机制

- 系统用户（`id='system'`）在种子数据中创建
- 注册时自动创建与系统用户的好友关系和欢迎会话
- 系统会话不可删除，系统会话中不允许发送消息
- 官方广播通过为每个用户创建独立私聊实现

### 11.5 权限模型

- **群聊角色**：owner（群主） > admin（管理员） > member（成员）
- **用户角色**：official/admin > user
- 群主可：设置管理员、转让群主、解散群聊
- 管理员可：修改群名/公告、移除普通成员
- 官方/管理员可：访问管理后台、发送广播、管理用户角色
