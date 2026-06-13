import { io, Socket } from 'socket.io-client';
import { ChatReceiveMessage, FriendRequest, StreamEvent } from '@biu/shared';

class SocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private token: string | null = null;
  private connectionListeners: ((connected: boolean) => void)[] = [];
  // 保存已注册的事件监听器，重连时自动重新绑定
  private registeredHandlers: Map<string, Function> = new Map();

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

  // 重连后重新绑定所有已注册的事件监听器
  private rebindHandlers() {
    if (!this.socket) return;
    this.registeredHandlers.forEach((callback, event) => {
      this.socket?.off(event);
      this.socket?.on(event, callback as any);
    });
  }

  connect(token: string) {
    this.token = token;

    if (this.socket?.connected) {
      return;
    }

    this.disconnect();

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
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
      // 重连后重新绑定事件监听器
      this.rebindHandlers();
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
    this.registeredHandlers.set('chat:message', callback);
    this.socket?.off('chat:message');
    this.socket?.on('chat:message', callback);
  }

  onTyping(callback: (data: { conversationId: string; userId: string }) => void) {
    this.registeredHandlers.set('chat:typing', callback);
    this.socket?.off('chat:typing');
    this.socket?.on('chat:typing', callback);
  }

  onUnread(callback: (data: { conversationId: string; count: number }) => void) {
    this.registeredHandlers.set('chat:unread', callback);
    this.socket?.off('chat:unread');
    this.socket?.on('chat:unread', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    this.registeredHandlers.set('user:online', callback);
    this.socket?.off('user:online');
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    this.registeredHandlers.set('user:offline', callback);
    this.socket?.off('user:offline');
    this.socket?.on('user:offline', callback);
  }

  onFriendRequest(callback: (data: FriendRequest) => void) {
    this.registeredHandlers.set('friend:request', callback);
    this.socket?.off('friend:request');
    this.socket?.on('friend:request', callback);
  }

  onChatError(callback: (data: { message: string; conversationId: string }) => void) {
    this.registeredHandlers.set('chat:error', callback);
    this.socket?.off('chat:error');
    this.socket?.on('chat:error', callback);
  }

  onChatAck(callback: (data: { messageId: string; conversationId: string }) => void) {
    this.registeredHandlers.set('chat:ack', callback);
    this.socket?.off('chat:ack');
    this.socket?.on('chat:ack', callback);
  }

  onChatStream(callback: (data: StreamEvent) => void) {
    this.registeredHandlers.set('chat:stream', callback);
    this.socket?.off('chat:stream');
    this.socket?.on('chat:stream', callback);
  }

  offMessage() {
    this.registeredHandlers.delete('chat:message');
    this.socket?.off('chat:message');
  }

  offTyping() {
    this.registeredHandlers.delete('chat:typing');
    this.socket?.off('chat:typing');
  }

  offUnread() {
    this.registeredHandlers.delete('chat:unread');
    this.socket?.off('chat:unread');
  }

  offFriendRequest() {
    this.registeredHandlers.delete('friend:request');
    this.socket?.off('friend:request');
  }

  offChatError() {
    this.registeredHandlers.delete('chat:error');
    this.socket?.off('chat:error');
  }

  offChatAck() {
    this.registeredHandlers.delete('chat:ack');
    this.socket?.off('chat:ack');
  }

  offChatStream() {
    this.registeredHandlers.delete('chat:stream');
    this.socket?.off('chat:stream');
  }

  sendMessage(data: { conversationId: string; content: string; type: string }) {
    if (!this.socket?.connected) {
      console.warn('[Socket] sendMessage called but socket not connected');
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
