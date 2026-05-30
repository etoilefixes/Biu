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
    this.socket?.on('chat:message', callback);
  }

  onTyping(callback: (data: { conversationId: string; userId: string }) => void) {
    this.socket?.on('chat:typing', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    this.socket?.on('user:offline', callback);
  }

  sendMessage(data: { conversationId: string; content: string; type: string }) {
    this.socket?.emit('chat:send', data);
  }

  sendTyping(conversationId: string) {
    this.socket?.emit('chat:typing', { conversationId });
  }

  private startHeartbeat() {
    setInterval(() => {
      this.socket?.emit('user:heartbeat');
    }, 60000);
  }
}

export const socketService = new SocketService();
