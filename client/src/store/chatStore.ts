import { create } from 'zustand';
import { Conversation, Message, LastMessage } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

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
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
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
  reset: () => void;
  cleanupStaleSending: () => void;
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
    set({
      conversations: sortConversations(conversations),
      unreadMap,
      totalUnread: calcTotalUnread(unreadMap),
    });
  },

  selectConversation: async (conversation) => {
    const { unreadMap } = get();
    const hasUnread = unreadMap[conversation.id] && unreadMap[conversation.id] > 0;

    if (hasUnread) {
      const newMap = { ...unreadMap };
      delete newMap[conversation.id];
      set({
        currentConversation: conversation,
        messages: [],
        unreadMap: newMap,
        totalUnread: calcTotalUnread(newMap),
      });
    } else {
      set({ currentConversation: conversation, messages: [] });
    }

    api.put(`/conversations/${conversation.id}/read`).catch(() => {});
    socketService.markRead(conversation.id);

    const res: any = await api.get(`/messages/${conversation.id}`);
    set({ messages: res.data });
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

    socketService.sendMessage({
      conversationId: currentConversation.id,
      content,
      type,
    });
  },

  addMessage: (message) => {
    const { messages } = get();
    const exists = messages.some((m) => m.id === message.id);
    if (exists) return;

    const optimisticIndex = messages.findIndex(
      (m) =>
        (m as any)._status === 'sending' &&
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
      set((state) => ({ messages: [...state.messages, message] }));
    }

    get().updateConversationLastMessage(message.conversationId, message);
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
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const lastMessage: LastMessage = {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderNickname: (message as any).sender?.nickname,
          createdAt: message.createdAt,
        };
        return { ...c, lastMessage };
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
    });
  },

  cleanupStaleSending: () => {
    const { messages } = get();
    const now = Date.now();
    const STALE_THRESHOLD_MS = 30000;
    let changed = false;

    const updated = messages.map((m) => {
      if ((m as any)._status !== 'sending') return m;

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
}));
