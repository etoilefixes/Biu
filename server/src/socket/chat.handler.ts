import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import * as messageService from '../modules/message/message.service';
import { generateAiReply } from '../modules/ai-role/ai-llm.service';

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on('chat:send', async (data) => {
    try {
      const message = await messageService.createMessage(
        data.conversationId,
        socket.data.userId,
        data.content,
        data.type || 'text',
        data.cardType || null,
        data.cardData || null
      );

      socket.emit('chat:ack', { messageId: message.id, conversationId: data.conversationId });

      const members = await getConversationMemberIds(data.conversationId);
      for (const memberId of members) {
        const socketId = await getSocketId(memberId);
        if (socketId) {
          io.to(socketId).emit('chat:message', message);
        }

        if (memberId !== socket.data.userId) {
          const unreadKey = `unread:${memberId}:${data.conversationId}`;
          const count = await redis.incr(unreadKey);

          const memberSocketId = await getSocketId(memberId);
          if (memberSocketId) {
            io.to(memberSocketId).emit('chat:unread', {
              conversationId: data.conversationId,
              count,
            });
          }
        }
      }

      // 异步触发 AI 角色回复（不阻塞消息发送）
      generateAiReply(data.conversationId, socket.data.userId).catch((err) => {
        console.error('[AI Reply] Error:', err);
      });
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
    const userId = socket.data.userId;
    const unreadKey = `unread:${userId}:${data.conversationId}`;
    await redis.set(unreadKey, '0');

    // Also update read position to latest message (matches HTTP markAsRead)
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: data.conversationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastMessage) {
      const readKey = `read:${userId}:${data.conversationId}`;
      await redis.set(readKey, lastMessage.createdAt.toISOString());
    }
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
