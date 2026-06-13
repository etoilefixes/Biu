import { io, Socket } from 'socket.io-client';
import { ChatReceiveMessage, FriendRequest, StreamEvent } from '@biu/shared';

class SocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private token: string | null = null;
  private connectionListeners: ((connected: boolean) => void)[] = [];

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    // 立即回调当前状态
    callback(this.socket?.connected ?? false);
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== callback);
    };
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionListeners.forEach((l) => l(connected));
  }

  connect(token: string) {
    this.token = token;

    if (this.socket?.connected) {
      return;
    }

    this.disconnect();

    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] connected, id:', this.socket?.id);
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] disconnected, reason:', reason);
      this.notifyConnectionChange(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] connect_error:', err.message);
      this.notifyConnectionChange(false);
    });

    this.startHeartbeat();
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(callback: (message: ChatReceiveMessage) => void) {
    console.log('[Socket] onMessage called, socket exists:', !!this.socket, 'connected:', this.socket?.connected);
    this.socket?.off('chat:message');
    this.socket?.on('chat:message', (data) => {
      console.log('[Socket] chat:message received:', JSON.stringify(data).substring(0, 200));
      callback(data);
    });
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

  onFriendRequest(callback: (data: FriendRequest) => void) {
    this.socket?.off('friend:request');
    this.socket?.on('friend:request', callback);
  }

  onChatError(callback: (data: { message: string; conversationId: string }) => void) {
    this.socket?.off('chat:error');
    this.socket?.on('chat:error', callback);
  }

  onChatAck(callback: (data: { messageId: string; conversationId: string }) => void) {
    this.socket?.off('chat:ack');
    this.socket?.on('chat:ack', callback);
  }

  onChatStream(callback: (data: StreamEvent) => void) {
    this.socket?.off('chat:stream');
    this.socket?.on('chat:stream', callback);
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

  offChatError() {
    this.socket?.off('chat:error');
  }

  offChatAck() {
    this.socket?.off('chat:ack');
  }

  offChatStream() {
    this.socket?.off('chat:stream');
  }

  sendMessage(data: { conversationId: string; content: string; type: string }) {
    if (!this.socket?.connected) {
      console.warn('[Socket] sendMessage called but socket not connected, attempting reconnect');
      if (this.token) {
        this.connect(this.token);
      }
      return false;
    }
    this.socket.emit('chat:send', data);
    return true;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  sendTyping(conversationId: string) {
    this.socket?.emit('chat:typing', { conversationId });
  }

  markRead(conversationId: string) {
    this.socket?.emit('chat:mark-read', { conversationId });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.socket?.emit('user:heartbeat');
    }, 60000);
  }
}

export const socketService = new SocketService();
