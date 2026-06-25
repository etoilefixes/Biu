# Biu

Biu 是一款面向团队的即时通讯（IM）应用，支持私聊、群聊、好友系统、AI 助手、官方账号广播、实时通知与徽章体系。项目采用 monorepo 架构，前后端分离，内置 OpenAPI 文档与自动化优化工具。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [开发脚本](#开发脚本)
- [API 文档](#api-文档)
- [自动化优化工具](#自动化优化工具)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 功能特性

- **即时通讯**：基于 Socket.IO 的实时消息收发，支持文本、Markdown、@提及、系统卡片消息。
- **好友系统**：发送/接受好友申请、删除好友、自动创建会话与欢迎消息。
- **会话管理**：已读回执、未读计数、消息持久化、乐观更新。
- **AI 助手**：可配置多模型 AI 角色，支持流式回复与模型管理。
- **官方账号**：后台管理、全员广播、权限控制。
- **通知系统**：桌面通知、声音提醒、消息预览开关、持久化偏好。
- **用户体系**：注册/登录、BiuId、徽章、在线状态。
- **API 文档**：自动生成 OpenAPI 3.0 规范，内置 Swagger UI。

---

## 技术栈

### 前端

- React 18 + TypeScript
- Vite
- React Router
- Zustand（状态管理）
- Tailwind CSS
- Socket.IO Client
- React Markdown + rehype-highlight + remark-gfm
- Framer Motion

### 后端

- Node.js + Express + TypeScript
- Socket.IO（实时通信）
- Prisma ORM
- Redis
- Zod（数据校验）
- bcrypt / jsonwebtoken

### 工程化

- npm workspaces
- tsx
- concurrently
- Vitest

---

## 项目结构

```text
biu/
├── client/                  # 前端应用（React + Vite）
│   ├── src/
│   │   ├── components/      # 通用组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 与 Socket 服务
│   │   ├── store/           # Zustand 状态管理
│   │   └── App.tsx
│   └── package.json
├── server/                  # 后端服务（Express + Socket.IO）
│   ├── src/
│   │   ├── modules/         # 业务模块
│   │   ├── config/          # 数据库、Redis、应用配置
│   │   ├── middleware/      # 中间件
│   │   └── app.ts
│   ├── prisma/              # Prisma schema 与迁移脚本
│   └── package.json
├── shared/                  # 前后端共享类型
├── biu-auto-optimizer/      # 自动化代码审查与优化工具
├── docs/                    # 项目文档
│   ├── api/                 # OpenAPI 规范与 API 参考
│   └── superpowers/         # 设计文档与实施计划
├── start.sh                 # 一键启动脚本
└── README.md
```

---

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9
- Redis 服务（本地或远程）
- 数据库（Prisma 默认使用 PostgreSQL，可通过 schema 切换）

### 1. 克隆仓库

```bash
git clone git@github.com:etoilefixes/Biu.git
cd Biu
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件并修改为你的实际配置：

```bash
cp server/.env.example server/.env
```

主要配置项参见下文 [环境变量](#环境变量)。

### 4. 初始化数据库

```bash
cd server
npx prisma migrate dev
npx prisma generate
```

### 5. 启动开发服务器

#### 方式一：使用一键启动脚本（推荐）

```bash
./start.sh
```

脚本会自动检查环境、安装缺失依赖、启动前后端服务，按 `Ctrl+C` 统一关闭。

#### 方式二：分别启动

```bash
# 终端 1：启动后端
cd server
npm run dev

# 终端 2：启动前端
cd client
npm run dev
```

前端默认地址：http://localhost:5173  
后端默认地址：http://localhost:3000

---

## 环境变量

后端环境变量位于 `server/.env`，主要字段如下：

| 变量名 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://user:pass@localhost:5432/biu` |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key` |
| `PORT` | 后端服务端口 | `3000` |

> 完整示例请查看 [server/.env.example](server/.env.example)。

---

## 开发脚本

### 根目录

| 命令 | 说明 |
|---|---|
| `./start.sh` | 一键启动前后端开发服务 |

### 前端（client）

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建生产包 |

### 后端（server）

| 命令 | 说明 |
|---|---|
| `npm run dev` | 使用 tsx watch 启动后端 |
| `npm run build` | 编译 TypeScript |
| `npm run start` | 运行编译后的生产服务 |
| `npm run db:migrate` | 执行 Prisma 迁移 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送 schema 到数据库 |
| `npm run create-official` | 创建官方账号 |
| `npm run create-ai` | 创建 AI 账号 |

---

## API 文档

项目内置了自动生成的 OpenAPI 文档与 Swagger UI。

启动后端后访问：

- Swagger UI：http://localhost:3000/api/docs
- OpenAPI JSON：http://localhost:3000/api/docs/openapi.json
- 重新生成文档：`POST http://localhost:3000/api/docs/regenerate`

文档生成脚本位于 [tools/generate_api_docs.py](tools/generate_api_docs.py)，Markdown 参考文档位于 [docs/api/api-reference.md](docs/api/api-reference.md)。

---

## 自动化优化工具

`biu-auto-optimizer/` 是 Biu 项目的自迭代自动化优化工具，支持：

- 代码审查与安全扫描
- 依赖健康度检查
- N+1 查询检测
- 复杂度与重复代码分析
- SOLID 原则检查
- 类型覆盖率统计
- 自动快照与回滚

快速开始：

```bash
cd biu-auto-optimizer
npm install
npm run build
npx tsx src/cli.ts run --dry-run
```

详细说明见 [biu-auto-optimizer/README.md](biu-auto-optimizer/README.md)。

---

## 贡献指南

1. Fork 本仓库。
2. 基于 `master` 分支创建功能分支：`git checkout -b feature/xxx`。
3. 提交代码时使用清晰的中文提交说明。
4. 确保 `tsc --noEmit` 与相关测试通过。
5. 发起 Pull Request 并描述改动内容。

---

## 许可证

本项目采用 [MIT 许可证](https://opensource.org/licenses/MIT)。

```text
MIT License

Copyright (c) 2026 etoilefixes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
