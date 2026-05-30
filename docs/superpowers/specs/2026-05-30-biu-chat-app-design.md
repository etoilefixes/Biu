# Biu 聊天软件设计文档

## 概述

Biu 是一款基于 Electron 的桌面即时通讯软件，支持 1 对 1 私聊和群聊，采用优雅现代的玻璃质感（Glassmorphism）UI 风格。

## 架构方案

**单体架构**：Electron 桌面端 + 独立 Node.js/Express 后端服务 + Socket.io 实时通信

- 前后端统一 TypeScript，开发效率高
- Socket.io 与 Node.js 天然集成，实时通信开箱即用
- 适合 MVP 快速迭代，后期可逐步拆分

## 项目结构

```
Biu/
├── client/                    # Electron 桌面端
│   ├── main/                  # Electron 主进程
│   │   ├── main.js            # 入口，窗口管理
│   │   └── preload.js         # 安全桥接
│   ├── src/                   # React 渲染进程
│   │   ├── components/        # UI 组件
│   │   ├── pages/             # 页面（登录、聊天、联系人）
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── store/             # 状态管理（Zustand）
│   │   ├── services/          # API & Socket 通信
│   │   └── styles/            # 全局样式
│   └── package.json
├── server/                    # Node.js 后端
│   ├── src/
│   │   ├── config/            # 配置（DB、Redis、JWT）
│   │   ├── middleware/        # 认证、错误处理
│   │   ├── modules/           # 业务模块
│   │   │   ├── auth/          # 注册、登录、JWT
│   │   │   ├── user/          # 用户资料、搜索
│   │   │   ├── message/       # 消息收发、历史
│   │   │   └── chat/          # 会话管理
│   │   ├── socket/            # Socket.io 事件处理
│   │   └── app.js             # Express 入口
│   └── package.json
└── shared/                    # 前后端共享类型定义
    └── types/
```

## 技术选型

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33+ |
| 前端框架 | React 18 + TypeScript |
| 状态管理 | Zustand |
| 样式方案 | Tailwind CSS |
| 构建工具 | Vite |
| 后端框架 | Express + TypeScript |
| 实时通信 | Socket.io |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 认证 | JWT + bcrypt |

## 数据模型

### PostgreSQL 表设计

#### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | VARCHAR(50) | 唯一用户名 |
| password_hash | VARCHAR(255) | bcrypt 加密密码 |
| nickname | VARCHAR(100) | 昵称 |
| avatar | VARCHAR(500) | 头像 URL |
| status | VARCHAR(20) | 在线状态：online/offline/away |
| created_at | TIMESTAMP | 注册时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### conversations（会话表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| type | VARCHAR(20) | 会话类型：private/group |
| name | VARCHAR(100) | 群聊名称（私聊为空） |
| creator_id | UUID | 创建者 |
| created_at | TIMESTAMP | 创建时间 |

#### conversation_members（会话成员表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| conversation_id | UUID | 关联会话 |
| user_id | UUID | 关联用户 |
| joined_at | TIMESTAMP | 加入时间 |

#### messages（消息表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| conversation_id | UUID | 关联会话 |
| sender_id | UUID | 发送者 |
| content | TEXT | 消息内容 |
| type | VARCHAR(20) | 消息类型：text/image/file |
| created_at | TIMESTAMP | 发送时间 |

### Redis 用途

- **在线状态**：`user:online:{userId}` → 在线状态 + 心跳 TTL
- **Socket 映射**：`user:socket:{userId}` → socketId，用于定向推送

## API 设计

### REST API

#### 认证模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册（username, password, nickname） |
| POST | /api/auth/login | 登录 → 返回 JWT token |
| GET | /api/auth/me | 获取当前用户信息 |

#### 用户模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users/search?keyword= | 搜索用户（按用户名/昵称） |
| PUT | /api/users/profile | 更新个人资料（昵称、头像） |

#### 会话模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/conversations | 获取会话列表 |
| POST | /api/conversations | 创建会话（私聊/群聊） |
| GET | /api/conversations/:id | 获取会话详情 |

#### 消息模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/messages/:conversationId?before=&limit= | 分页加载历史消息 |
| POST | /api/messages/:conversationId | 发送消息（REST 备用，主要走 Socket） |

### Socket.io 事件

#### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|------|------|------|
| `chat:send` | `{ conversationId, content, type }` | 发送消息 |
| `chat:typing` | `{ conversationId }` | 正在输入 |

#### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `chat:message` | `{ id, conversationId, sender, content, type, createdAt }` | 新消息推送 |
| `chat:typing` | `{ conversationId, userId }` | 对方正在输入 |
| `user:online` | `{ userId }` | 用户上线 |
| `user:offline` | `{ userId }` | 用户下线 |

### 认证流程

1. 客户端 POST `/api/auth/login` → 获取 JWT
2. 后续 REST 请求 Header 携带 `Authorization: Bearer <token>`
3. Socket.io 连接时在 `auth` 参数传递 token，服务端 middleware 验证

## UI 设计

### 窗口结构

主窗口采用经典三栏布局：

```
┌──────────────────────────────────────────────┐
│  ◉ Biu                          — □ ✕      │
├────────┬──────────────┬──────────────────────┤
│        │              │                      │
│  导航栏  │   会话列表     │     聊天区域         │
│  60px   │   280px      │     自适应            │
│        │              │                      │
│  👤     │  🔍 搜索      │  对方昵称 / 群名       │
│  💬     │              │  ──────────────────  │
│  📋     │  会话1        │                      │
│  ⚙️     │  会话2        │  消息气泡区域          │
│        │  会话3        │  （玻璃质感背景）       │
│        │              │                      │
│        │              │  ──────────────────  │
│        │              │  输入框  [发送]        │
├────────┴──────────────┴──────────────────────┤
```

### 页面清单

1. **登录/注册页** — 全屏，玻璃质感卡片居中，模糊背景
2. **主聊天页** — 三栏布局，左侧导航 + 会话列表 + 聊天区
3. **联系人页** — 搜索用户，发起私聊
4. **个人资料页** — 修改昵称、头像

### 玻璃质感设计要点

- 半透明背景 `rgba(255,255,255,0.1)` + `backdrop-filter: blur(20px)`
- 微弱边框 `1px solid rgba(255,255,255,0.2)`
- 渐变主背景（深蓝紫色调）
- 消息气泡：自己的消息偏右（主色调），对方消息偏左（玻璃质感）
- 圆角 12-16px，柔和阴影

## 错误处理

- **REST API**：统一错误响应格式 `{ code, message, details }`，HTTP 状态码语义化（401/403/404/422/500）
- **Socket.io**：消息发送失败时服务端回传 `chat:error` 事件，客户端显示发送失败标记并支持重试
- **前端**：全局错误边界（Error Boundary）捕获渲染异常，Toast 提示网络/业务错误
- **数据库**：Prisma 连接池管理，查询失败自动重试（最多 3 次）

## 安全措施

- **密码**：bcrypt 哈希（salt rounds = 10）
- **JWT**：HS256 签名，access token 7天过期，存储在 Electron 安全存储（safeStorage）
- **Socket.io**：连接时验证 JWT，无效则断开
- **输入校验**：服务端使用 Zod 校验所有输入，防 XSS 和 SQL 注入
- **CORS**：仅允许 Electron 客户端来源
