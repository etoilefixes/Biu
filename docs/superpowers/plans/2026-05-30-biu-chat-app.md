# Biu 聊天软件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零构建一款基于 Electron + React + Node.js 的桌面即时通讯软件 Biu

**Architecture:** 单体架构，Electron 桌面端（React + Vite + Tailwind CSS）+ 独立 Node.js/Express 后端 + Socket.io 实时通信 + PostgreSQL + Redis，前后端共享 TypeScript 类型

**Tech Stack:** Electron 33+, React 18, TypeScript, Zustand, Tailwind CSS, Vite, Express, Socket.io, Prisma, PostgreSQL, Redis, JWT, bcrypt, Zod

---

## File Structure

### shared/
- `shared/types/index.ts` — 前后端共享的 TypeScript 类型定义

### server/
- `server/package.json` — 后端依赖
- `server/tsconfig.json` — TypeScript 配置
- `server/.env.example` — 环境变量模板
- `server/src/config/index.ts` — 配置加载（env、JWT secret、DB URL）
- `server/src/config/database.ts` — Prisma 客户端实例
- `server/src/config/redis.ts` — Redis 客户端实例
- `server/src/middleware/auth.ts` — JWT 认证中间件
- `server/src/middleware/errorHandler.ts` — 全局错误处理中间件
- `server/src/middleware/validate.ts` — Zod 请求校验中间件
- `server/src/modules/auth/auth.routes.ts` — 认证路由
- `server/src/modules/auth/auth.controller.ts` — 认证控制器
- `server/src/modules/auth/auth.service.ts` — 认证业务逻辑
- `server/src/modules/auth/auth.schema.ts` — Zod 校验 schema
- `server/src/modules/user/user.routes.ts` — 用户路由
- `server/src/modules/user/user.controller.ts` — 用户控制器
- `server/src/modules/user/user.service.ts` — 用户业务逻辑
- `server/src/modules/chat/chat.routes.ts` — 会话路由
- `server/src/modules/chat/chat.controller.ts` — 会话控制器
- `server/src/modules/chat/chat.service.ts` — 会话业务逻辑
- `server/src/modules/message/message.routes.ts` — 消息路由
- `server/src/modules/message/message.controller.ts` — 消息控制器
- `server/src/modules/message/message.service.ts` — 消息业务逻辑
- `server/src/socket/index.ts` — Socket.io 初始化与事件绑定
- `server/src/socket/chat.handler.ts` — 聊天相关 Socket 事件处理
- `server/src/socket/user.handler.ts` — 用户在线状态处理
- `server/src/app.ts` — Express 应用入口

### client/
- `client/package.json` — 前端依赖
- `client/tsconfig.json` — TypeScript 配置
- `client/vite.config.ts` — Vite 配置
- `client/tailwind.config.js` — Tailwind 配置
- `client/postcss.config.js` — PostCSS 配置
- `client/index.html` — HTML 入口
- `client/main/main.ts` — Electron 主进程
- `client/main/preload.ts` — preload 脚本
- `client/src/main.tsx` — React 入口
- `client/src/App.tsx` — 根组件（路由）
- `client/src/styles/globals.css` — 全局样式 + 玻璃质感基础
- `client/src/services/api.ts` — REST API 封装
- `client/src/services/socket.ts` — Socket.io 客户端封装
- `client/src/store/authStore.ts` — 认证状态
- `client/src/store/chatStore.ts` — 聊天状态
- `client/src/components/GlassCard.tsx` — 玻璃质感卡片组件
- `client/src/components/Toast.tsx` — Toast 提示组件
- `client/src/components/ErrorBoundary.tsx` — 错误边界
- `client/src/components/ChatBubble.tsx` — 消息气泡组件
- `client/src/components/ConversationItem.tsx` — 会话列表项组件
- `client/src/components/NavBar.tsx` — 左侧导航栏组件
- `client/src/pages/LoginPage.tsx` — 登录页
- `client/src/pages/RegisterPage.tsx` — 注册页
- `client/src/pages/ChatPage.tsx` — 主聊天页
- `client/src/pages/ContactsPage.tsx` — 联系人页
- `client/src/pages/ProfilePage.tsx` — 个人资料页

---

### Task 1: 项目脚手架与共享类型

**Files:**
- Create: `shared/types/index.ts`
- Create: `package.json` (根目录 workspace 配置)

- [ ] **Step 1: 初始化根目录 workspace**

```bash
cd /d/Biu
```

创建根 `package.json`:

```json
{
  "name": "biu",
  "private": true,
  "workspaces": ["shared", "server", "client"]
}
```

- [ ] **Step 2: 创建 shared 包**

创建 `shared/package.json`:

```json
{
  "name": "@biu/shared",
  "version": "1.0.0",
  "main": "types/index.ts",
  "types": "types/index.ts"
}
```

创建 `shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["types"]
}
```

- [ ] **Step 3: 编写共享类型定义**

创建 `shared/types/index.ts`:

```typescript
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  creatorId: string;
  createdAt: string;
  members: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
  sender?: User;
}

export interface ChatSendMessage {
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'file';
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
  username: string;
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
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: initialize workspace and shared types"
```

---

### Task 2: 后端项目初始化与 Prisma Schema

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/prisma/schema.prisma`

- [ ] **Step 1: 初始化 server 包**

创建 `server/package.json`:

```json
{
  "name": "@biu/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@biu/shared": "*",
    "@prisma/client": "^5.22.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "redis": "^4.7.0",
    "socket.io": "^4.8.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

创建 `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@biu/shared": ["../shared/types"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 2: 创建环境变量模板**

创建 `server/.env.example`:

```
DATABASE_URL=postgresql://postgres:123456@localhost:5432/biu
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
```

创建 `server/.env`（实际开发用）:

```
DATABASE_URL=postgresql://postgres:123456@localhost:5432/biu
REDIS_URL=redis://localhost:6379
JWT_SECRET=biu-dev-jwt-secret-2026
JWT_EXPIRES_IN=7d
PORT=3001
```

- [ ] **Step 3: 编写 Prisma Schema**

创建 `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  username     String   @unique @db.VarChar(50)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  nickname     String   @db.VarChar(100)
  avatar       String?  @db.VarChar(500)
  status       String   @default("offline") @db.VarChar(20)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  conversations ConversationMember[]
  messages      Message[]

  @@map("users")
}

model Conversation {
  id        String   @id @default(uuid())
  type      String   @db.VarChar(20)
  name      String?  @db.VarChar(100)
  creatorId String   @map("creator_id")
  createdAt DateTime @default(now()) @map("created_at")

  members  ConversationMember[]
  messages Message[]

  @@map("conversations")
}

model ConversationMember {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  userId         String   @map("user_id")
  joinedAt       DateTime @default(now()) @map("joined_at")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@map("conversation_members")
}

model Message {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  senderId       String   @map("sender_id")
  content        String
  type           String   @default("text") @db.VarChar(20)
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  sender       User         @relation(fields: [senderId], references: [id])

  @@map("messages")
}
```

- [ ] **Step 4: 安装依赖并生成 Prisma 客户端**

```bash
cd /d/Biu
npm install
cd server
npx prisma generate
```

- [ ] **Step 5: 运行数据库迁移**

```bash
cd /d/Biu/server
npx prisma migrate dev --name init
```

- [ ] **Step 6: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: initialize server with Prisma schema and database migration"
```

---

### Task 3: 后端配置与中间件

**Files:**
- Create: `server/src/config/index.ts`
- Create: `server/src/config/database.ts`
- Create: `server/src/config/redis.ts`
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/src/middleware/validate.ts`

- [ ] **Step 1: 创建配置模块**

创建 `server/src/config/index.ts`:

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'biu-dev-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
```

安装 dotenv:

```bash
cd /d/Biu/server
npm install dotenv
```

创建 `server/src/config/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

创建 `server/src/config/redis.ts`:

```typescript
import { createClient } from 'redis';
import { config } from './index';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => console.error('Redis Client Error:', err));

export async function connectRedis() {
  await redis.connect();
  console.log('Redis connected');
}
```

- [ ] **Step 2: 创建 JWT 认证中间件**

创建 `server/src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }
}
```

- [ ] **Step 3: 创建错误处理中间件**

创建 `server/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);
  res.status(500).json({ code: 500, message: '服务器内部错误', details: err.message });
}
```

- [ ] **Step 4: 创建 Zod 校验中间件**

创建 `server/src/middleware/validate.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          code: 422,
          message: '输入校验失败',
          details: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }
      next(err);
    }
  };
}
```

- [ ] **Step 5: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add server config, database, redis, and middleware"
```

---

### Task 4: 后端认证模块

**Files:**
- Create: `server/src/modules/auth/auth.schema.ts`
- Create: `server/src/modules/auth/auth.service.ts`
- Create: `server/src/modules/auth/auth.controller.ts`
- Create: `server/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: 创建 Zod 校验 Schema**

创建 `server/src/modules/auth/auth.schema.ts`:

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  nickname: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
```

- [ ] **Step 2: 创建认证业务逻辑**

创建 `server/src/modules/auth/auth.service.ts`:

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { RegisterRequest, LoginRequest } from '@biu/shared';

const SALT_ROUNDS = 10;

export async function register(data: RegisterRequest) {
  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      nickname: data.nickname,
    },
  });

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status as 'online' | 'offline' | 'away',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

export async function login(data: LoginRequest) {
  const user = await prisma.user.findUnique({ where: { username: data.username } });
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new Error('用户名或密码错误');
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status as 'online' | 'offline' | 'away',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    status: user.status as 'online' | 'offline' | 'away',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 3: 创建认证控制器**

创建 `server/src/modules/auth/auth.controller.ts`:

```typescript
import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ code: 201, message: '注册成功', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.login(req.body);
    res.json({ code: 200, message: '登录成功', data: result });
  } catch (err: any) {
    res.status(401).json({ code: 401, message: err.message });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ code: 200, message: '获取成功', data: user });
  } catch (err: any) {
    res.status(404).json({ code: 404, message: err.message });
  }
}
```

- [ ] **Step 4: 创建认证路由**

创建 `server/src/modules/auth/auth.routes.ts`:

```typescript
import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './auth.schema';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.me);

export default router;
```

- [ ] **Step 5: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add auth module (register, login, me)"
```

---

### Task 5: 后端用户模块

**Files:**
- Create: `server/src/modules/user/user.service.ts`
- Create: `server/src/modules/user/user.controller.ts`
- Create: `server/src/modules/user/user.routes.ts`

- [ ] **Step 1: 创建用户业务逻辑**

创建 `server/src/modules/user/user.service.ts`:

```typescript
import { prisma } from '../../config/database';

export async function searchUsers(keyword: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: keyword, mode: 'insensitive' } },
        { nickname: { contains: keyword, mode: 'insensitive' } },
      ],
      NOT: { id: currentUserId },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 20,
  });

  return users.map((u) => ({
    ...u,
    status: u.status as 'online' | 'offline' | 'away',
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
}

export async function updateProfile(userId: string, data: { nickname?: string; avatar?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...user,
    status: user.status as 'online' | 'offline' | 'away',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: 创建用户控制器**

创建 `server/src/modules/user/user.controller.ts`:

```typescript
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as userService from './user.service';

export async function search(req: AuthRequest, res: Response) {
  try {
    const keyword = req.query.keyword as string || '';
    const users = await userService.searchUsers(keyword, req.userId!);
    res.json({ code: 200, message: '搜索成功', data: users });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const user = await userService.updateProfile(req.userId!, req.body);
    res.json({ code: 200, message: '更新成功', data: user });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
```

- [ ] **Step 3: 创建用户路由**

创建 `server/src/modules/user/user.routes.ts`:

```typescript
import { Router } from 'express';
import * as userController from './user.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/search', authMiddleware, userController.search);
router.put('/profile', authMiddleware, userController.updateProfile);

export default router;
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add user module (search, update profile)"
```

---

### Task 6: 后端会话模块

**Files:**
- Create: `server/src/modules/chat/chat.service.ts`
- Create: `server/src/modules/chat/chat.controller.ts`
- Create: `server/src/modules/chat/chat.routes.ts`

- [ ] **Step 1: 创建会话业务逻辑**

创建 `server/src/modules/chat/chat.service.ts`:

```typescript
import { prisma } from '../../config/database';

export async function getConversations(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, nickname: true, avatar: true, status: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { conversation: { createdAt: 'desc' } },
  });

  return memberships.map((m) => ({
    id: m.conversation.id,
    type: m.conversation.type,
    name: m.conversation.name,
    creatorId: m.conversation.creatorId,
    createdAt: m.conversation.createdAt.toISOString(),
    members: m.conversation.members.map((mem) => ({
      id: mem.id,
      conversationId: mem.conversationId,
      userId: mem.userId,
      joinedAt: mem.joinedAt.toISOString(),
      user: {
        ...mem.user,
        status: mem.user.status as 'online' | 'offline' | 'away',
      },
    })),
    lastMessage: m.conversation.messages[0]
      ? {
          id: m.conversation.messages[0].id,
          content: m.conversation.messages[0].content,
          senderId: m.conversation.messages[0].senderId,
          createdAt: m.conversation.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function createConversation(
  userId: string,
  data: { type: 'private' | 'group'; name?: string; memberIds: string[] }
) {
  if (data.type === 'private') {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'private',
        members: {
          every: { userId: { in: [userId, ...data.memberIds] } },
        },
      },
      include: {
        members: true,
      },
    });

    if (existing && existing.members.length === data.memberIds.length + 1) {
      return getConversationDetail(existing.id, userId);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: data.type,
      name: data.name || null,
      creatorId: userId,
      members: {
        create: [
          { userId },
          ...data.memberIds.map((memberId) => ({ userId: memberId })),
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true },
          },
        },
      },
    },
  });

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
      },
    })),
  };
}

export async function getConversationDetail(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权访问此会话');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true, status: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('会话不存在');
  }

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    creatorId: conversation.creatorId,
    createdAt: conversation.createdAt.toISOString(),
    members: conversation.members.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        ...m.user,
        status: m.user.status as 'online' | 'offline' | 'away',
      },
    })),
  };
}
```

- [ ] **Step 2: 创建会话控制器**

创建 `server/src/modules/chat/chat.controller.ts`:

```typescript
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as chatService from './chat.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const conversations = await chatService.getConversations(req.userId!);
    res.json({ code: 200, message: '获取成功', data: conversations });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const conversation = await chatService.createConversation(req.userId!, req.body);
    res.status(201).json({ code: 201, message: '创建成功', data: conversation });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function detail(req: AuthRequest, res: Response) {
  try {
    const conversation = await chatService.getConversationDetail(req.params.id, req.userId!);
    res.json({ code: 200, message: '获取成功', data: conversation });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}
```

- [ ] **Step 3: 创建会话路由**

创建 `server/src/modules/chat/chat.routes.ts`:

```typescript
import { Router } from 'express';
import * as chatController from './chat.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, chatController.list);
router.post('/', authMiddleware, chatController.create);
router.get('/:id', authMiddleware, chatController.detail);

export default router;
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add conversation module (list, create, detail)"
```

---

### Task 7: 后端消息模块

**Files:**
- Create: `server/src/modules/message/message.service.ts`
- Create: `server/src/modules/message/message.controller.ts`
- Create: `server/src/modules/message/message.routes.ts`

- [ ] **Step 1: 创建消息业务逻辑**

创建 `server/src/modules/message/message.service.ts`:

```typescript
import { prisma } from '../../config/database';

export async function getMessages(
  conversationId: string,
  userId: string,
  before?: string,
  limit: number = 50
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });

  if (!membership) {
    throw new Error('无权访问此会话');
  }

  const where: any = { conversationId };
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return messages
    .reverse()
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      type: m.type as 'text' | 'image' | 'file',
      createdAt: m.createdAt.toISOString(),
      sender: {
        ...m.sender,
        status: m.sender.status as 'online' | 'offline' | 'away',
      },
    }));
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: string = 'text'
) {
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: senderId },
  });

  if (!membership) {
    throw new Error('无权在此会话发送消息');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type,
    },
    include: {
      sender: {
        select: { id: true, username: true, nickname: true, avatar: true, status: true },
      },
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: message.type as 'text' | 'image' | 'file',
    createdAt: message.createdAt.toISOString(),
    sender: {
      ...message.sender,
      status: message.sender.status as 'online' | 'offline' | 'away',
    },
  };
}
```

- [ ] **Step 2: 创建消息控制器**

创建 `server/src/modules/message/message.controller.ts`:

```typescript
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as messageService from './message.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const before = req.query.before as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const messages = await messageService.getMessages(
      req.params.conversationId,
      req.userId!,
      before,
      limit
    );
    res.json({ code: 200, message: '获取成功', data: messages });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const message = await messageService.createMessage(
      req.params.conversationId,
      req.userId!,
      req.body.content,
      req.body.type
    );
    res.status(201).json({ code: 201, message: '发送成功', data: message });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
```

- [ ] **Step 3: 创建消息路由**

创建 `server/src/modules/message/message.routes.ts`:

```typescript
import { Router } from 'express';
import * as messageController from './message.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/:conversationId', authMiddleware, messageController.list);
router.post('/:conversationId', authMiddleware, messageController.create);

export default router;
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add message module (list, create)"
```

---

### Task 8: Socket.io 实时通信

**Files:**
- Create: `server/src/socket/index.ts`
- Create: `server/src/socket/chat.handler.ts`
- Create: `server/src/socket/user.handler.ts`

- [ ] **Step 1: 创建 Socket.io 初始化**

创建 `server/src/socket/index.ts`:

```typescript
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redis } from '../config/redis';
import { registerChatHandlers } from './chat.handler';
import { registerUserHandlers } from './user.handler';

export function setupSocket(io: SocketServer) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证失败'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('令牌无效'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    console.log(`User ${userId} connected`);

    await redis.set(`user:socket:${userId}`, socket.id);
    await redis.set(`user:online:${userId}`, 'online', { EX: 300 });
    io.emit('user:online', { userId });

    registerChatHandlers(io, socket);
    registerUserHandlers(io, socket);

    socket.on('disconnect', async () => {
      console.log(`User ${userId} disconnected`);
      await redis.del(`user:socket:${userId}`);
      await redis.del(`user:online:${userId}`);
      io.emit('user:offline', { userId });
    });
  });
}
```

- [ ] **Step 2: 创建聊天事件处理器**

创建 `server/src/socket/chat.handler.ts`:

```typescript
import { Server, Socket } from 'socket.io';
import * as messageService from '../modules/message/message.service';

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on('chat:send', async (data) => {
    try {
      const message = await messageService.createMessage(
        data.conversationId,
        socket.data.userId,
        data.content,
        data.type || 'text'
      );

      const members = await getConversationMemberIds(data.conversationId);
      for (const memberId of members) {
        const socketId = await getSocketId(memberId);
        if (socketId) {
          io.to(socketId).emit('chat:message', message);
        }
      }
    } catch (err: any) {
      socket.emit('chat:error', { message: err.message, conversationId: data.conversationId });
    }
  });

  socket.on('chat:typing', async (data) => {
    const members = await getConversationMemberIds(data.conversationId);
    for (const memberId of members) {
      if (memberId !== socket.data.userId) {
        const socketId = await getSocketId(memberId);
        if (socketId) {
          io.to(socketId).emit('chat:typing', {
            conversationId: data.conversationId,
            userId: socket.data.userId,
          });
        }
      }
    }
  });
}

async function getConversationMemberIds(conversationId: string): Promise<string[]> {
  const { prisma } = await import('../config/database');
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getSocketId(userId: string): Promise<string | null> {
  const { redis } = await import('../config/redis');
  return redis.get(`user:socket:${userId}`);
}
```

- [ ] **Step 3: 创建用户状态处理器**

创建 `server/src/socket/user.handler.ts`:

```typescript
import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';

export function registerUserHandlers(io: Server, socket: Socket) {
  socket.on('user:heartbeat', async () => {
    const userId = socket.data.userId as string;
    await redis.set(`user:online:${userId}`, 'online', { EX: 300 });
  });
}
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add Socket.io real-time communication handlers"
```

---

### Task 9: 后端应用入口

**Files:**
- Create: `server/src/app.ts`

- [ ] **Step 1: 创建 Express 应用入口**

创建 `server/src/app.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import { connectRedis } from './config/redis';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import chatRoutes from './modules/chat/chat.routes';
import messageRoutes from './modules/message/message.routes';
import { setupSocket } from './socket';

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/messages', messageRoutes);

app.use(errorHandler);

setupSocket(io);

async function start() {
  try {
    await connectRedis();
    await prisma.$connect();
    console.log('Database connected');

    server.listen(config.port, () => {
      console.log(`Biu server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 2: 验证服务启动**

```bash
cd /d/Biu/server
npx tsx src/app.ts
```

预期输出：
```
Redis connected
Database connected
Biu server running on port 3001
```

确认后停止服务。

- [ ] **Step 3: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add Express app entry point with all routes and Socket.io"
```

---

### Task 10: 客户端项目初始化

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/index.html`

- [ ] **Step 1: 初始化 client 包**

创建 `client/package.json`:

```json
{
  "name": "@biu/client",
  "version": "1.0.0",
  "main": "main/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "vite build && electron-builder"
  },
  "dependencies": {
    "@biu/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0",
    "socket.io-client": "^4.8.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^9.1.0",
    "electron": "^33.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "wait-on": "^8.0.0"
  }
}
```

创建 `client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@biu/shared": ["../shared/types"],
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "main"]
}
```

- [ ] **Step 2: 创建 Vite 配置**

创建 `client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@biu/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 3: 创建 Tailwind 配置**

创建 `client/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        biu: {
          primary: '#6C5CE7',
          secondary: '#A29BFE',
          dark: '#0A0A1A',
          surface: '#1A1A2E',
          'surface-light': '#25253E',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
};
```

创建 `client/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: 创建 HTML 入口**

创建 `client/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Biu</title>
  </head>
  <body class="bg-biu-dark">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖**

```bash
cd /d/Biu
npm install
```

- [ ] **Step 6: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: initialize client with Vite, React, Tailwind CSS"
```

---

### Task 11: Electron 主进程与全局样式

**Files:**
- Create: `client/main/main.ts`
- Create: `client/main/preload.ts`
- Create: `client/src/main.tsx`
- Create: `client/src/styles/globals.css`

- [ ] **Step 1: 创建 Electron 主进程**

创建 `client/main/main.ts`:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0A0A1A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

创建 `client/main/preload.ts`:

```typescript
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
```

- [ ] **Step 2: 创建全局样式**

创建 `client/src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .glass {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .glass-strong {
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .gradient-bg {
    background: linear-gradient(135deg, #0A0A1A 0%, #1A1A2E 50%, #16213E 100%);
  }

  .bubble-self {
    background: linear-gradient(135deg, #6C5CE7, #A29BFE);
    border-radius: 16px 16px 4px 16px;
  }

  .bubble-other {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px 16px 16px 4px;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #E2E8F0;
  overflow: hidden;
  user-select: none;
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
```

- [ ] **Step 3: 创建 React 入口**

创建 `client/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add Electron main process, preload, and global styles"
```

---

### Task 12: 客户端服务层与状态管理

**Files:**
- Create: `client/src/services/api.ts`
- Create: `client/src/services/socket.ts`
- Create: `client/src/store/authStore.ts`
- Create: `client/src/store/chatStore.ts`

- [ ] **Step 1: 创建 API 服务**

创建 `client/src/services/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('biu_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || '网络错误';
    return Promise.reject(new Error(message));
  }
);

export default api;
```

- [ ] **Step 2: 创建 Socket 服务**

创建 `client/src/services/socket.ts`:

```typescript
import { io, Socket } from 'socket.io-client';
import { ChatReceiveMessage } from '@biu/shared';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.startHeartbeat();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(callback: (message: ChatReceiveMessage) => void) {
    this.socket?.on('chat:message', callback);
  }

  onTyping(callback: (data: { conversationId: string; userId: string }) => void) {
    this.socket?.on('chat:typing', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    this.socket?.on('user:offline', callback);
  }

  sendMessage(data: { conversationId: string; content: string; type: string }) {
    this.socket?.emit('chat:send', data);
  }

  sendTyping(conversationId: string) {
    this.socket?.emit('chat:typing', { conversationId });
  }

  private startHeartbeat() {
    setInterval(() => {
      this.socket?.emit('user:heartbeat');
    }, 60000);
  }
}

export const socketService = new SocketService();
```

- [ ] **Step 3: 创建认证状态**

创建 `client/src/store/authStore.ts`:

```typescript
import { create } from 'zustand';
import { User } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('biu_token'),
  isAuthenticated: !!localStorage.getItem('biu_token'),

  login: async (username, password) => {
    const res: any = await api.post('/auth/login', { username, password });
    const { token, user } = res.data;
    localStorage.setItem('biu_token', token);
    socketService.connect(token);
    set({ user, token, isAuthenticated: true });
  },

  register: async (username, password, nickname) => {
    const res: any = await api.post('/auth/register', { username, password, nickname });
    const { token, user } = res.data;
    localStorage.setItem('biu_token', token);
    socketService.connect(token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('biu_token');
    socketService.disconnect();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const res: any = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('biu_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
```

- [ ] **Step 4: 创建聊天状态**

创建 `client/src/store/chatStore.ts`:

```typescript
import { create } from 'zustand';
import { Conversation, Message } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  typingUsers: Map<string, string>;
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  sendMessage: (content: string, type?: string) => void;
  addMessage: (message: Message) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  typingUsers: new Map(),

  loadConversations: async () => {
    const res: any = await api.get('/conversations');
    set({ conversations: res.data });
  },

  selectConversation: async (conversation) => {
    set({ currentConversation: conversation, messages: [] });
    const res: any = await api.get(`/messages/${conversation.id}`);
    set({ messages: res.data });
  },

  sendMessage: (content, type = 'text') => {
    const { currentConversation } = get();
    if (!currentConversation) return;
    socketService.sendMessage({
      conversationId: currentConversation.id,
      content,
      type,
    });
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  setTyping: (conversationId, userId) => {
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.set(conversationId, userId);
      return { typingUsers: newMap };
    });
    setTimeout(() => get().clearTyping(conversationId), 3000);
  },

  clearTyping: (conversationId) => {
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.delete(conversationId);
      return { typingUsers: newMap };
    });
  },
}));
```

- [ ] **Step 5: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add client services (api, socket) and stores (auth, chat)"
```

---

### Task 13: 客户端基础组件

**Files:**
- Create: `client/src/components/GlassCard.tsx`
- Create: `client/src/components/Toast.tsx`
- Create: `client/src/components/ErrorBoundary.tsx`

- [ ] **Step 1: 创建玻璃质感卡片组件**

创建 `client/src/components/GlassCard.tsx`:

```tsx
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}

export default function GlassCard({ children, className = '', strong = false }: GlassCardProps) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass'} rounded-2xl shadow-lg ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 创建 Toast 组件**

创建 `client/src/components/Toast.tsx`:

```tsx
import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    error: 'bg-red-500/80',
    success: 'bg-green-500/80',
    info: 'bg-biu-primary/80',
  }[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg ${bgColor} backdrop-blur-md text-white text-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 3: 创建错误边界组件**

创建 `client/src/components/ErrorBoundary.tsx`:

```tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen gradient-bg text-white">
          <div className="text-center">
            <h2 className="text-xl mb-2">出了点问题</h2>
            <button
              className="px-4 py-2 bg-biu-primary rounded-lg hover:bg-biu-secondary transition"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add base UI components (GlassCard, Toast, ErrorBoundary)"
```

---

### Task 14: 登录与注册页面

**Files:**
- Create: `client/src/pages/LoginPage.tsx`
- Create: `client/src/pages/RegisterPage.tsx`
- Create: `client/src/App.tsx`

- [ ] **Step 1: 创建登录页**

创建 `client/src/pages/LoginPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/chat');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen gradient-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GlassCard className="w-96 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Biu</h1>
          <p className="text-gray-400 text-sm">登录你的账号</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="text-center text-gray-400 text-sm mt-6">
          还没有账号？{' '}
          <Link to="/register" className="text-biu-secondary hover:text-white transition">
            注册
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2: 创建注册页**

创建 `client/src/pages/RegisterPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(username, password, nickname);
      navigate('/chat');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen gradient-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GlassCard className="w-96 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Biu</h1>
          <p className="text-gray-400 text-sm">创建新账号</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="text-center text-gray-400 text-sm mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-biu-secondary hover:text-white transition">
            登录
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 3: 创建根组件与路由**

创建 `client/src/App.tsx`:

```tsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { socketService } from './services/socket';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ContactsPage from './pages/ContactsPage';
import ProfilePage from './pages/ProfilePage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const { isAuthenticated, loadUser, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      loadUser();
      socketService.connect(token);
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <PrivateRoute>
                <ContactsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/chat' : '/login'} />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 4: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add login, register pages and app routing"
```

---

### Task 15: 主聊天页面

**Files:**
- Create: `client/src/components/NavBar.tsx`
- Create: `client/src/components/ConversationItem.tsx`
- Create: `client/src/components/ChatBubble.tsx`
- Create: `client/src/pages/ChatPage.tsx`

- [ ] **Step 1: 创建导航栏组件**

创建 `client/src/components/NavBar.tsx`:

```tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const items = [
    { path: '/chat', icon: '💬', label: '消息' },
    { path: '/contacts', icon: '📋', label: '联系人' },
    { path: '/profile', icon: '👤', label: '我的' },
  ];

  return (
    <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-6">
      <div className="w-10 h-10 rounded-full bg-biu-primary flex items-center justify-center text-white text-sm font-bold mb-4">
        {user?.nickname?.[0] || 'B'}
      </div>
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition ${
            location.pathname === item.path
              ? 'bg-biu-primary/30 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建会话列表项组件**

创建 `client/src/components/ConversationItem.tsx`:

```tsx
import React from 'react';
import { Conversation } from '@biu/shared';

interface Props {
  conversation: Conversation & { lastMessage?: { content: string; createdAt: string } | null };
  active: boolean;
  onClick: () => void;
  currentUserId: string;
}

export default function ConversationItem({ conversation, active, onClick, currentUserId }: Props) {
  const displayName =
    conversation.type === 'group'
      ? conversation.name
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname || '未知用户';

  const avatar =
    conversation.type === 'group'
      ? conversation.name?.[0] || '群'
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname?.[0] || '?';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
        active ? 'bg-biu-primary/20' : 'hover:bg-white/5'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-biu-secondary/30 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-white text-sm font-medium truncate">{displayName}</span>
        </div>
        <p className="text-gray-500 text-xs truncate mt-0.5">
          {conversation.lastMessage?.content || '暂无消息'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建消息气泡组件**

创建 `client/src/components/ChatBubble.tsx`:

```tsx
import React from 'react';
import { Message } from '@biu/shared';

interface Props {
  message: Message;
  isSelf: boolean;
}

export default function ChatBubble({ message, isSelf }: Props) {
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isSelf && (
        <div className="w-8 h-8 rounded-full bg-biu-secondary/30 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">
          {message.sender?.nickname?.[0] || '?'}
        </div>
      )}
      <div className="max-w-[60%]">
        {!isSelf && (
          <p className="text-gray-500 text-xs mb-1">{message.sender?.nickname}</p>
        )}
        <div className={`px-4 py-2 ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
          <p className="text-white text-sm break-words">{message.content}</p>
        </div>
        <p className="text-gray-600 text-xs mt-1">
          {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建主聊天页面**

创建 `client/src/pages/ChatPage.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import NavBar from '../components/NavBar';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const {
    conversations,
    currentConversation,
    messages,
    loadConversations,
    selectConversation,
    sendMessage,
    addMessage,
    setTyping,
  } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    socketService.onMessage(addMessage);
    socketService.onTyping((data) => setTyping(data.conversationId, data.userId));
    return () => socketService.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const convDisplayName = (conv: typeof currentConversation) => {
    if (!conv) return '';
    if (conv.type === 'group') return conv.name;
    return conv.members.find((m) => m.userId !== user?.id)?.user?.nickname || '未知用户';
  };

  return (
    <div className="flex h-screen gradient-bg">
      <NavBar />
      <div className="w-[280px] glass border-r border-white/5 flex flex-col">
        <div className="p-3">
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-500 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv: any) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={currentConversation?.id === conv.id}
              onClick={() => selectConversation(conv)}
              currentUserId={user?.id || ''}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
              <h2 className="text-white font-medium">{convDisplayName(currentConversation)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} isSelf={msg.senderId === user?.id} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 glass-strong border-t border-white/5">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-6 py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            选择一个会话开始聊天
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add main chat page with three-column layout"
```

---

### Task 16: 联系人与个人资料页面

**Files:**
- Create: `client/src/pages/ContactsPage.tsx`
- Create: `client/src/pages/ProfilePage.tsx`

- [ ] **Step 1: 创建联系人页面**

创建 `client/src/pages/ContactsPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';
import NavBar from '../components/NavBar';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { User } from '@biu/shared';

export default function ContactsPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const user = useAuthStore((s) => s.user);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    try {
      const res: any = await api.get(`/users/search?keyword=${keyword}`);
      setResults(res.data);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res: any = await api.post('/conversations', {
        type: 'private',
        memberIds: [targetUserId],
      });
      await loadConversations();
      navigate('/chat');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="flex h-screen gradient-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <NavBar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">联系人</h1>
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索用户名或昵称..."
            className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition"
          >
            搜索
          </button>
        </div>
        <div className="space-y-3">
          {results.map((u) => (
            <GlassCard key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-biu-secondary/30 flex items-center justify-center text-white text-sm font-bold">
                  {u.nickname[0]}
                </div>
                <div>
                  <p className="text-white font-medium">{u.nickname}</p>
                  <p className="text-gray-500 text-xs">@{u.username}</p>
                </div>
              </div>
              <button
                onClick={() => handleStartChat(u.id)}
                className="px-4 py-2 rounded-lg bg-biu-primary/20 text-biu-secondary hover:bg-biu-primary/40 transition text-sm"
              >
                发消息
              </button>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建个人资料页面**

创建 `client/src/pages/ProfilePage.tsx`:

```tsx
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import NavBar from '../components/NavBar';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

export default function ProfilePage() {
  const { user, loadUser, logout } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    try {
      await api.put('/users/profile', { nickname });
      await loadUser();
      setEditing(false);
      setToast({ message: '更新成功', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="flex h-screen gradient-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <NavBar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">个人资料</h1>
        <GlassCard className="max-w-lg p-6 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-biu-primary flex items-center justify-center text-white text-2xl font-bold">
              {user?.nickname?.[0] || 'B'}
            </div>
            <div>
              <p className="text-white text-lg font-medium">{user?.nickname}</p>
              <p className="text-gray-500 text-sm">@{user?.username}</p>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm">昵称</label>
            {editing ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full mt-1 px-4 py-2 rounded-lg glass-input text-white outline-none focus:border-biu-primary transition"
              />
            ) : (
              <p className="text-white mt-1">{user?.nickname}</p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-biu-primary hover:bg-biu-secondary text-white transition"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg glass text-gray-400 hover:text-white transition"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-lg bg-biu-primary/20 text-biu-secondary hover:bg-biu-primary/40 transition"
              >
                编辑资料
              </button>
            )}
          </div>
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition"
            >
              退出登录
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
cd /d/Biu
git add -A
git commit -m "feat: add contacts and profile pages"
```

---

### Task 17: 集成测试与启动验证

**Files:**
- Modify: `client/vite.config.ts`（添加 Electron 构建配置）

- [ ] **Step 1: 启动 PostgreSQL 和 Redis**

确认 PostgreSQL 和 Redis 服务正在运行：

```bash
wsl bash -c "sudo service postgresql start && sudo service redis-server start"
```

- [ ] **Step 2: 运行数据库迁移**

```bash
cd /d/Biu/server
npx prisma migrate dev --name init
```

- [ ] **Step 3: 启动后端服务**

```bash
cd /d/Biu/server
npx tsx src/app.ts
```

预期输出：
```
Redis connected
Database connected
Biu server running on port 3001
```

- [ ] **Step 4: 启动前端开发服务器**

新终端：

```bash
cd /d/Biu/client
npx vite
```

预期：Vite 开发服务器在 http://localhost:5173 启动

- [ ] **Step 5: 使用浏览器验证前端**

打开 http://localhost:5173，验证：
- 登录页面正常显示
- 玻璃质感样式正确渲染
- 注册功能正常工作
- 登录后跳转到聊天页面
- 三栏布局正确显示

- [ ] **Step 6: 提交最终状态**

```bash
cd /d/Biu
git add -A
git commit -m "feat: complete Biu MVP - verify integration and startup"
```
