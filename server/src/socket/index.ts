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
