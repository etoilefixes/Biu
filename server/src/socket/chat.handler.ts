import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
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
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getSocketId(userId: string): Promise<string | null> {
  return redis.get(`user:socket:${userId}`);
}
