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

        if (memberId !== socket.data.userId) {
          const unreadKey = `unread:${memberId}:${data.conversationId}`;
          const current = parseInt(await redis.get(unreadKey) || '0', 10);
          await redis.set(unreadKey, String(current + 1));

          const memberSocketId = await getSocketId(memberId);
          if (memberSocketId) {
            io.to(memberSocketId).emit('chat:unread', {
              conversationId: data.conversationId,
              count: current + 1,
            });
          }
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

  socket.on('chat:mark-read', async (data: { conversationId: string }) => {
    const unreadKey = `unread:${socket.data.userId}:${data.conversationId}`;
    await redis.set(unreadKey, '0');
  });

  socket.on('friend:request', async (data) => {
    const toSocketId = await getSocketId(data.toUserId);
    if (toSocketId) {
      io.to(toSocketId).emit('friend:request', data);
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
