import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import { config } from '../config';
import { registerChatHandlers } from './chat.handler';
import { registerUserHandlers } from './user.handler';

let ioInstance: Server | null = null;

export let io: Server | null = null;

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized');
  }
  return ioInstance;
}

// 延迟确认离线，避免短暂断连导致频繁 online/offline 闪烁
const OFFLINE_DELAY_MS = 5000;
// 在线状态键 TTL（秒）— 与心跳 TTL 一致，确保进程崩溃或网络断开时键能自动过期
const ONLINE_TTL_SEC = 300;
const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function setupSocket(server: Server) {
  ioInstance = server;
  io = server;

  server.on('connection', async (socket: Socket) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      const userId = decoded.userId;

      socket.data.userId = userId;

      // 取消待执行的离线定时器（重连场景）
      const pendingTimer = offlineTimers.get(userId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        offlineTimers.delete(userId);
      }

      // 连接时给 socket/status key 设置 TTL，防止进程崩溃时键永久残留
      await redis.set(`user:socket:${userId}`, socket.id, { EX: ONLINE_TTL_SEC });
      await redis.set(`user:status:${userId}`, 'online', { EX: ONLINE_TTL_SEC });
      await redis.set(`user:online:${userId}`, 'online', { EX: ONLINE_TTL_SEC });
      server.emit('user:online', { userId });

      registerChatHandlers(server, socket);
      registerUserHandlers(server, socket);

      socket.on('disconnect', async () => {
        // 延迟确认离线：如果用户在短时间内重连，则不触发 offline
        const timer = setTimeout(async () => {
          offlineTimers.delete(userId);
          // 再次确认该用户确实没有其他活跃连接
          const currentSocketId = await redis.get(`user:socket:${userId}`);
          if (currentSocketId === socket.id) {
            // 同步清理三套在线状态键，保持一致性
            await redis.del(`user:socket:${userId}`);
            await redis.set(`user:status:${userId}`, 'offline');
            await redis.del(`user:online:${userId}`);
            server.emit('user:offline', { userId });
          }
        }, OFFLINE_DELAY_MS);
        offlineTimers.set(userId, timer);
      });
    } catch (err) {
      console.error('Socket auth error:', err);
      socket.disconnect();
    }
  });
}
