import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';

// 心跳 TTL（秒）— 略大于客户端心跳间隔，确保心跳停止后键能自动过期
const ONLINE_TTL_SEC = 300;

export function registerUserHandlers(io: Server, socket: Socket) {
  socket.on('user:heartbeat', async () => {
    const userId = socket.data.userId as string;
    if (!userId) return;
    // 心跳时同步刷新三套在线状态键的 TTL，防止进程崩溃或网络断开（TCP 未触发 FIN）时键永久残留
    await redis.set(`user:online:${userId}`, 'online', { EX: ONLINE_TTL_SEC });
    await redis.set(`user:socket:${userId}`, socket.id, { EX: ONLINE_TTL_SEC });
    await redis.set(`user:status:${userId}`, 'online', { EX: ONLINE_TTL_SEC });
  });
}
