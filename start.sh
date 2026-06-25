#!/usr/bin/env bash
# Biu 项目一键启动脚本
# 同时启动后端（server）和前端（client）开发服务器
# 用法：./start.sh

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Biu 启动器${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[Biu 启动器] 错误：未检测到 Node.js，请先安装 Node.js。${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}[Biu 启动器] Node.js 版本：$NODE_VERSION${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[Biu 启动器] 错误：未检测到 npm，请先安装 npm。${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}[Biu 启动器] npm 版本：$NPM_VERSION${NC}"

# 检查并安装依赖
if [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ] || [ ! -d "shared/node_modules" ]; then
    echo -e "${YELLOW}[Biu 启动器] 检测到依赖缺失，正在安装项目依赖...${NC}"
    npm install
else
    echo -e "${GREEN}[Biu 启动器] 依赖已安装${NC}"
fi

# 检查后端环境变量文件
if [ ! -f "server/.env" ]; then
    if [ -f "server/.env.example" ]; then
        echo -e "${YELLOW}[Biu 启动器] 未找到 server/.env，已从 .env.example 复制一份，请按需修改配置。${NC}"
        cp server/.env.example server/.env
    else
        echo -e "${YELLOW}[Biu 启动器] 警告：未找到 server/.env 与 .env.example，请手动创建环境变量文件。${NC}"
    fi
else
    echo -e "${GREEN}[Biu 启动器] 后端环境变量文件已存在${NC}"
fi

# 启动后端服务
echo -e "${BLUE}[Biu 启动器] 正在启动后端服务（server）...${NC}"
cd server
npm run dev &
SERVER_PID=$!
cd ..

# 启动前端应用
echo -e "${BLUE}[Biu 启动器] 正在启动前端应用（client）...${NC}"
cd client
npm run dev &
CLIENT_PID=$!
cd ..

# 清理函数：收到终止信号时关闭所有子进程
cleanup() {
    echo -e "\n${YELLOW}[Biu 启动器] 正在关闭所有服务...${NC}"
    kill $SERVER_PID $CLIENT_PID 2>/dev/null || true
    wait $SERVER_PID $CLIENT_PID 2>/dev/null || true
    echo -e "${GREEN}[Biu 启动器] 所有服务已关闭${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${GREEN}[Biu 启动器] 后端服务 PID：$SERVER_PID${NC}"
echo -e "${GREEN}[Biu 启动器] 前端应用 PID：$CLIENT_PID${NC}"
echo -e "${BLUE}[Biu 启动器] 服务启动中，请稍候...${NC}"
echo -e "${YELLOW}[Biu 启动器] 按 Ctrl+C 停止所有服务${NC}"
echo -e "${BLUE}========================================${NC}"

# 等待所有后台进程
wait
