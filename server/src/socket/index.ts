import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';
import { registerChatHandlers } from './chat.handler';
import { registerUserHandlers } from './user.handler';

let ioInstance: Server | null = null;

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized');
  }
  return ioInstance;
}

export async function setupSocket(io: Server) {
  ioInstance = io;

  io.on('connection', async (socket: Socket) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const userId = socket.handshake.auth.userId || (socket as any).userId;
      if (userId) {
        await redis.set(`user:socket:${userId}`, socket.id);
        await redis.set(`user:status:${userId}`, 'online');
        io.emit('user:online', { userId });
        (socket as any).userId = userId;
      }

      registerChatHandlers(io, socket);
      registerUserHandlers(io, socket);

      socket.on('disconnect', async () => {
        if (userId) {
          await redis.del(`user:socket:${userId}`);
          await redis.set(`user:status:${userId}`, 'offline');
          io.emit('user:offline', { userId });
        }
      });
    } catch (err) {
      console.error('Socket connection error:', err);
      socket.disconnect();
    }
  });
}
