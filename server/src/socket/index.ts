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
      await redis.set(`user:socket:${userId}`, socket.id);
      await redis.set(`user:status:${userId}`, 'online');
      server.emit('user:online', { userId });

      registerChatHandlers(server, socket);
      registerUserHandlers(server, socket);

      socket.on('disconnect', async () => {
        await redis.del(`user:socket:${userId}`);
        await redis.set(`user:status:${userId}`, 'offline');
        server.emit('user:offline', { userId });
      });
    } catch (err) {
      console.error('Socket auth error:', err);
      socket.disconnect();
    }
  });
}
