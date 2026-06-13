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

      await redis.set(`user:socket:${userId}`, socket.id);
      await redis.set(`user:status:${userId}`, 'online');
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
            await redis.del(`user:socket:${userId}`);
            await redis.set(`user:status:${userId}`, 'offline');
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
