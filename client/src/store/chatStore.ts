import { create } from 'zustand';
import { Conversation, Message, LastMessage, StreamEvent } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';
import { useAuthStore } from './authStore';

interface UnreadMap {
  [conversationId: string]: number;
}

interface PendingAck {
  tempId: string;
  conversationId: string;
  content: string;
  timer: ReturnType<typeof setTimeout>;
  retryCount: number;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  typingUsers: Map<string, string>;
  unreadMap: UnreadMap;
  totalUnread: number;
  lastReadMessageId: string | null;
  streamingMessages: Map<string, { content: string; reasoning: string; isStreaming: boolean; senderId?: string }>;
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation | null) => Promise<void>;
  sendMessage: (content: string, type?: string, senderId?: string) => void;
  addMessage: (message: Message) => void;
  removeMessage: (tempId: string) => void;
  markMessageFailed: (tempId: string) => void;
  replaceTempMessage: (tempId: string, realMessage: Message) => void;
  addConversationOptimistic: (conversation: Conversation) => void;
  replaceTempConversation: (tempId: string, realConversation: Conversation) => void;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
  setUnread: (conversationId: string, count: number) => void;
  clearUnread: (conversationId: string) => void;
  markAllRead: () => void;
  deleteConversation: (conversationId: string) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
  handleStreamEvent: (data: StreamEvent) => void;
  reset: () => void;
  cleanupStaleSending: () => void;
  retryFailedMessages: () => void;
}

function calcTotalUnread(unreadMap: UnreadMap): number {
  return Object.values(unreadMap).reduce((sum, n) => sum + n, 0);
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.createdAt;
    const bTime = b.lastMessage?.createdAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

let tempIdCounter = 0;

const pendingAcks = new Map<string, PendingAck>();

const ACK_TIMEOUT_MS = 10000;
const MAX_RETRY_COUNT = 1;

// 流式输出节流：合并 delta 后统一更新，减少渲染次数
const STREAM_BATCH_MS = 50;
const streamBuffers = new Map<string, { content: string; reasoning: string; timer: ReturnType<typeof setTimeout> | null }>();

function flushStreamBuffer(conversationId: string) {
  const buffer = streamBuffers.get(conversationId);
  if (!buffer) return;

  const { content, reasoning } = buffer;
  streamBuffers.delete(conversationId);

  const currentConvId = useChatStore.getState().currentConversation?.id;

  // 更新 streamingMessages
  const newStreaming = new Map(useChatStore.getState().streamingMessages);
  const current = newStreaming.get(conversationId) || { content: '', reasoning: '', isStreaming: true };
  current.content = content || current.content;
  current.reasoning = reasoning || current.reasoning;
  newStreaming.set(conversationId, current);
  useChatStore.setState({ streamingMessages: newStreaming });

  // 更新占位消息
  if (conversationId === currentConvId) {
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== `stream_${conversationId}`) return m;
        const updated = { ...m, content: current.content } as any;
        if (reasoning) updated._streamingReasoning = current.reasoning;
        return updated;
      }),
    }));
  }
}

function clearPendingAck(tempId: string) {
  const pending = pendingAcks.get(tempId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingAcks.delete(tempId);
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  typingUsers: new Map(),
  unreadMap: {},
  totalUnread: 0,
  lastReadMessageId: null,
  streamingMessages: new Map(),

  loadConversations: async () => {
    const res: any = await api.get('/conversations');
    const conversations: Conversation[] = res.data;
    const currentId = get().currentConversation?.id;
    const unreadMap: UnreadMap = {};
    conversations.forEach((c: any) => {
      if (c.unreadCount > 0 && c.id !== currentId) {
        unreadMap[c.id] = c.unreadCount;
      }
    });
    const freshCurrent = currentId
      ? conversations.find((c) => c.id === currentId) ?? null
      : null;
    set({
      conversations: sortConversations(conversations),
      currentConversation: freshCurrent,
      unreadMap,
      totalUnread: calcTotalUnread(unreadMap),
    });
  },

  selectConversation: async (conversation) => {
    if (!conversation) {
      set({ currentConversation: null, messages: [], lastReadMessageId: null });
      return;
    }

    const { unreadMap } = get();
    const hasUnread = unreadMap[conversation.id] && unreadMap[conversation.id] > 0;

    // Clear mentionType for the selected conversation
    const conversations = get().conversations.map((c) =>
      c.id === conversation.id ? { ...c, mentionType: null } : c
    );
    const cleanConversation = { ...conversation, mentionType: null };

    // 先更新会话信息，但不清空消息（避免闪烁）
    if (hasUnread) {
      const newMap = { ...unreadMap };
      delete newMap[conversation.id];
      set({
        conversations,
        currentConversation: cleanConversation,
        unreadMap: newMap,
        totalUnread: calcTotalUnread(newMap),
      });
    } else {
      set({ conversations, currentConversation: cleanConversation });
    }

    // Fetch messages FIRST — the server returns lastReadAt before mark-read
    const res: any = await api.get(`/messages/${conversation.id}`);

    // 竞态保护：如果在 await 期间用户又切换了会话，丢弃本次响应
    if (get().currentConversation?.id !== conversation.id) {
      return;
    }

    // Defensive: handle both new format { messages, lastReadAt } and legacy array
    const fetchedMessages: Message[] = Array.isArray(res.data) ? res.data : (res.data?.messages ?? []);
    const lastReadAt: string | null = Array.isArray(res.data) ? null : (res.data?.lastReadAt ?? null);

    // Compute the divider anchor: first message after lastReadAt
    let lastReadMessageId: string | null = null;
    if (lastReadAt && fetchedMessages.length > 0) {
      const readTime = new Date(lastReadAt).getTime();
      const firstUnread = fetchedMessages.find(
        (m: Message) => new Date(m.createdAt).getTime() > readTime
      );
      if (firstUnread) {
        lastReadMessageId = firstUnread.id;
      }
    }

    // 一次性设置新消息和 lastReadMessageId
    set({ messages: fetchedMessages, lastReadMessageId });

    // 流式恢复：如果该会话仍有活跃的流式输出（用户切换走又切回），重新插入占位消息
    const activeStream = get().streamingMessages.get(conversation.id);
    if (activeStream?.isStreaming) {
      const streamMsg: Message = {
        id: `stream_${conversation.id}`,
        conversationId: conversation.id,
        senderId: activeStream.senderId ?? '',
        content: activeStream.content,
        type: 'text',
        createdAt: new Date().toISOString(),
        _isStreaming: true,
        _streamingReasoning: activeStream.reasoning || undefined,
      } as any;
      set((state) => ({
        messages: [...state.messages, streamMsg],
      }));
    }

    // Now mark as read (after messages are fetched with the anchor)
    api.put(`/conversations/${conversation.id}/read`).catch(() => {});
    socketService.markRead(conversation.id);
  },

  sendMessage: (content, type = 'text', senderId) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const tempId = `temp_${Date.now()}_${++tempIdCounter}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversationId: currentConversation.id,
      senderId: senderId || '',
      content,
      type: type as 'text',
      createdAt: new Date().toISOString(),
      _status: 'sending',
      _tempSender: senderId || '',
    } as any;

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    get().updateConversationLastMessage(currentConversation.id, optimisticMessage);

    // 检查 socket 连接状态
    if (!socketService.isConnected()) {
      // socket 未连接，直接标记为失败
      console.warn('[ChatStore] Socket not connected, marking message as failed');
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempId ? { ...m, _status: 'failed' } : m
        ),
      }));
      return;
    }

    const sent = socketService.sendMessage({
      conversationId: currentConversation.id,
      content,
      type,
    });

    if (!sent) {
      // 发送失败，标记消息
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempId ? { ...m, _status: 'failed' } : m
        ),
      }));
      return;
    }

    const ackTimer = setTimeout(() => {
      const { messages } = get();
      const stillSending = messages.find((m) => m.id === tempId && (m as any)._status === 'sending');
      if (!stillSending) {
        clearPendingAck(tempId);
        return;
      }

      const pending = pendingAcks.get(tempId);
      if (pending && pending.retryCount < MAX_RETRY_COUNT) {
        pending.retryCount++;
        socketService.sendMessage({
          conversationId: currentConversation.id,
          content,
          type,
        });

        pending.timer = setTimeout(() => {
          const { messages: msgs2 } = get();
          const still = msgs2.find((m) => m.id === tempId && (m as any)._status === 'sending');
          if (still) {
            get().markMessageFailed(tempId);
          }
          clearPendingAck(tempId);
        }, ACK_TIMEOUT_MS);
      } else {
        get().markMessageFailed(tempId);
        clearPendingAck(tempId);
      }
    }, ACK_TIMEOUT_MS);

    pendingAcks.set(tempId, {
      tempId,
      conversationId: currentConversation.id,
      content,
      timer: ackTimer,
      retryCount: 0,
    });
  },

  addMessage: (message) => {
    const { messages } = get();
    const exists = messages.some((m) => m.id === message.id);
    if (exists) return;

    // 检查是否是流式占位消息的替换
    const streamIndex = messages.findIndex(
      (m) => m.id === `stream_${message.conversationId}`
    );

    if (streamIndex !== -1) {
      set({
        messages: messages.map((m, i) => (i === streamIndex ? message : m)),
      });
      // 清理流式状态
      const newStreaming = new Map(get().streamingMessages);
      newStreaming.delete(message.conversationId);
      set({ streamingMessages: newStreaming });
    } else {
      const optimisticIndex = messages.findIndex(
        (m) =>
          ((m as any)._status === 'sending' || (m as any)._status === 'sent') &&
          m.conversationId === message.conversationId &&
          m.content === message.content &&
          ((m as any)._tempSender === message.senderId ||
            m.senderId === message.senderId ||
            !m.senderId)
      );

      if (optimisticIndex !== -1) {
        const matchedTempId = messages[optimisticIndex].id;
        clearPendingAck(matchedTempId);

        set({
          messages: messages.map((m, i) => (i === optimisticIndex ? message : m)),
        });
      } else {
        // Only add to messages array if it belongs to the current conversation
        const currentConvId = get().currentConversation?.id;
        if (message.conversationId === currentConvId) {
          set((state) => ({ messages: [...state.messages, message] }));
        }
      }
    }

    // 系统消息不更新会话列表的 lastMessage 预览
    if (message.type !== 'system') {
      get().updateConversationLastMessage(message.conversationId, message);
    }
  },

  removeMessage: (tempId) => {
    clearPendingAck(tempId);
    set((state) => ({ messages: state.messages.filter((m) => m.id !== tempId) }));
  },

  markMessageFailed: (tempId) => {
    clearPendingAck(tempId);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? { ...m, _status: 'failed' } : m
      ),
    }));
  },

  replaceTempMessage: (tempId, realMessage) => {
    clearPendingAck(tempId);
    set((state) => ({
      messages: state.messages.map((m) => (m.id === tempId ? realMessage : m)),
    }));
  },

  addConversationOptimistic: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation,
      messages: [],
    }));
  },

  replaceTempConversation: (tempId, realConversation) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === tempId ? realConversation : c
      ),
      currentConversation:
        state.currentConversation?.id === tempId
          ? realConversation
          : state.currentConversation,
    }));
  },

  updateConversationLastMessage: (conversationId, message) => {
    set((state) => {
      const currentUserId = useAuthStore.getState().user?.id;
      const msgMentions = message.mentions ?? null;
      const msgMentionsAll = message.mentionsAll ?? false;
      let mentionType: 'me' | 'all' | null | undefined = undefined; // undefined = don't update
      if (msgMentionsAll) {
        mentionType = 'all';
      } else if (msgMentions && currentUserId && msgMentions.includes(currentUserId)) {
        mentionType = 'me';
      }

      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const lastMessage: LastMessage = {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderNickname: (message as any).sender?.nickname,
          createdAt: message.createdAt,
          mentions: msgMentions,
          mentionsAll: msgMentionsAll,
        };
        const updated = { ...c, lastMessage };
        if (mentionType !== undefined) {
          (updated as any).mentionType = mentionType;
        }
        return updated;
      });

      return { conversations: sortConversations(conversations) };
    });
  },

  setUnread: (conversationId, count) => {
    set((state) => {
      const newMap = { ...state.unreadMap, [conversationId]: count };
      return { unreadMap: newMap, totalUnread: calcTotalUnread(newMap) };
    });
  },

  clearUnread: (conversationId) => {
    set((state) => {
      const newMap = { ...state.unreadMap };
      delete newMap[conversationId];
      return { unreadMap: newMap, totalUnread: calcTotalUnread(newMap) };
    });
  },

  markAllRead: () => {
    set({ unreadMap: {}, totalUnread: 0 });
    api.put('/conversations/read-all').catch(() => {});
  },

  deleteConversation: (conversationId) => {
    set((state) => {
      const newMap = { ...state.unreadMap };
      delete newMap[conversationId];
      return {
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation,
        messages: state.currentConversation?.id === conversationId ? [] : state.messages,
        unreadMap: newMap,
        totalUnread: calcTotalUnread(newMap),
      };
    });
    api.delete(`/conversations/${conversationId}`).catch(() => {});
  },

  setTyping: (conversationId, userId) => {
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.set(conversationId, userId);
      return { typingUsers: newMap };
    });
    setTimeout(() => get().clearTyping(conversationId), 3000);
  },

  clearTyping: (conversationId) => {
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.delete(conversationId);
      return { typingUsers: newMap };
    });
  },

  handleStreamEvent: (data) => {
    const { conversationId, type } = data;
    const currentConvId = get().currentConversation?.id;

    if (type === 'start') {
      // 流式开始：创建占位流式消息
      const newStreaming = new Map(get().streamingMessages);
      newStreaming.set(conversationId, { content: '', reasoning: '', isStreaming: true, senderId: data.aiUserId });
      set({ streamingMessages: newStreaming });

      // 在当前会话的消息列表中添加一个占位消息
      if (conversationId === currentConvId && data.aiUserId) {
        const streamMsg: Message = {
          id: `stream_${conversationId}`,
          conversationId,
          senderId: data.aiUserId,
          content: '',
          type: 'text',
          createdAt: new Date().toISOString(),
          _isStreaming: true,
        } as any;
        set((state) => {
          const exists = state.messages.some((m) => m.id === `stream_${conversationId}`);
          if (exists) return state;
          return { messages: [...state.messages, streamMsg], lastReadMessageId: null };
        });
      }
    } else if (type === 'content' && data.delta) {
      // 内容增量 — 节流合并
      const buffer = streamBuffers.get(conversationId) || { content: '', reasoning: '', timer: null };
      const newStreaming = new Map(get().streamingMessages);
      const current = newStreaming.get(conversationId) || { content: '', reasoning: '', isStreaming: true };
      current.content += data.delta;
      newStreaming.set(conversationId, current);
      buffer.content = current.content;

      if (!buffer.timer) {
        buffer.timer = setTimeout(() => flushStreamBuffer(conversationId), STREAM_BATCH_MS);
      }
      streamBuffers.set(conversationId, buffer);
      set({ streamingMessages: newStreaming });
    } else if (type === 'reasoning' && data.delta) {
      // 推理增量 — 节流合并
      const buffer = streamBuffers.get(conversationId) || { content: '', reasoning: '', timer: null };
      const newStreaming = new Map(get().streamingMessages);
      const current = newStreaming.get(conversationId) || { content: '', reasoning: '', isStreaming: true };
      current.reasoning += data.delta;
      newStreaming.set(conversationId, current);
      buffer.reasoning = current.reasoning;

      if (!buffer.timer) {
        buffer.timer = setTimeout(() => flushStreamBuffer(conversationId), STREAM_BATCH_MS);
      }
      streamBuffers.set(conversationId, buffer);
      set({ streamingMessages: newStreaming });
    } else if (type === 'done') {
      // 流式结束：刷新缓冲区并移除流式状态
      const buffer = streamBuffers.get(conversationId);
      if (buffer?.timer) {
        clearTimeout(buffer.timer);
        streamBuffers.delete(conversationId);
      }
      flushStreamBuffer(conversationId);

      const newStreaming = new Map(get().streamingMessages);
      const streamData = newStreaming.get(conversationId);
      newStreaming.delete(conversationId);
      set({ streamingMessages: newStreaming });

      // 如果有最终内容，更新占位消息
      if (conversationId === currentConvId) {
        const finalContent = data.content || streamData?.content || '';
        const finalReasoning = data.reasoning || streamData?.reasoning || '';
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === `stream_${conversationId}`
              ? { ...m, content: finalContent, _isStreaming: false, _streamingReasoning: finalReasoning } as any
              : m
          ),
        }));
      }
    } else if (type === 'error') {
      // 流式错误：清除缓冲区
      const buffer = streamBuffers.get(conversationId);
      if (buffer?.timer) {
        clearTimeout(buffer.timer);
        streamBuffers.delete(conversationId);
      }

      const newStreaming = new Map(get().streamingMessages);
      newStreaming.delete(conversationId);
      set({ streamingMessages: newStreaming });

      if (conversationId === currentConvId) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === `stream_${conversationId}`
              ? { ...m, content: data.message || 'AI 回复失败', _isStreaming: false } as any
              : m
          ),
        }));
      }
    }
  },

  reset: () => {
    pendingAcks.forEach((pending) => clearTimeout(pending.timer));
    pendingAcks.clear();
    set({
      conversations: [],
      currentConversation: null,
      messages: [],
      typingUsers: new Map(),
      unreadMap: {},
      totalUnread: 0,
      lastReadMessageId: null,
      streamingMessages: new Map(),
    });
  },

  cleanupStaleSending: () => {
    const { messages } = get();
    const now = Date.now();
    const STALE_THRESHOLD_MS = 30000;
    let changed = false;

    const updated = messages.map((m) => {
      const status = (m as any)._status;
      if (status !== 'sending' && status !== 'sent') return m;

      const msgTime = new Date(m.createdAt).getTime();
      if (now - msgTime > STALE_THRESHOLD_MS) {
        clearPendingAck(m.id);
        changed = true;
        return { ...m, _status: 'failed' as const };
      }
      return m;
    });

    if (changed) {
      set({ messages: updated });
    }
  },

  retryFailedMessages: () => {
    const { messages, currentConversation } = get();
    if (!currentConversation) return;

    const failedMessages = messages.filter(
      (m) => (m as any)._status === 'failed' && m.conversationId === currentConversation.id
    );

    for (const msg of failedMessages) {
      get().removeMessage(msg.id);
      get().sendMessage(msg.content, msg.type, msg.senderId || undefined);
    }
  },
}));
