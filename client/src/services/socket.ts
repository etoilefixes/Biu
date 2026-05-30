import { io, Socket } from 'socket.io-client';
import { ChatReceiveMessage } from '@biu/shared';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.startHeartbeat();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(callback: (message: ChatReceiveMessage) => void) {
    this.socket?.off('chat:message');
    this.socket?.on('chat:message', callback);
  }

  onTyping(callback: (data: { conversationId: string; userId: string }) => void) {
    this.socket?.off('chat:typing');
    this.socket?.on('chat:typing', callback);
  }

  onUnread(callback: (data: { conversationId: string; count: number }) => void) {
    this.socket?.off('chat:unread');
    this.socket?.on('chat:unread', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    this.socket?.off('user:online');
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    this.socket?.off('user:offline');
    this.socket?.on('user:offline', callback);
  }

  onFriendRequest(callback: (data: any) => void) {
    this.socket?.off('friend:request');
    this.socket?.on('friend:request', callback);
  }

  offMessage() {
    this.socket?.off('chat:message');
  }

  offTyping() {
    this.socket?.off('chat:typing');
  }

  offUnread() {
    this.socket?.off('chat:unread');
  }

  offFriendRequest() {
    this.socket?.off('friend:request');
  }

  sendMessage(data: { conversationId: string; content: string; type: string }) {
    this.socket?.emit('chat:send', data);
  }

  sendTyping(conversationId: string) {
    this.socket?.emit('chat:typing', { conversationId });
  }

  markRead(conversationId: string) {
    this.socket?.emit('chat:mark-read', { conversationId });
  }

  private startHeartbeat() {
    setInterval(() => {
      this.socket?.emit('user:heartbeat');
    }, 60000);
  }
}

export const socketService = new SocketService();
