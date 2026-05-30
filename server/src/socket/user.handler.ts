import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';

export function registerUserHandlers(io: Server, socket: Socket) {
  socket.on('user:heartbeat', async () => {
    const userId = socket.data.userId as string;
    await redis.set(`user:online:${userId}`, 'online', { EX: 300 });
  });
}
