import { create } from 'zustand';
import { Conversation, Message, LastMessage } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

interface UnreadMap {
  [conversationId: string]: number;
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
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
  reset: () => void;
}

function calcTotalUnread(unreadMap: UnreadMap): number {
  return Object.values(unreadMap).reduce((sum, n) => sum + n, 0);
}

let tempIdCounter = 0;

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
      conversations,
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
    } as any;

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    get().updateConversationLastMessage(currentConversation.id, optimisticMessage);

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
        m.senderId === message.senderId
    );

    if (optimisticIndex !== -1) {
      set({
        messages: messages.map((m, i) => (i === optimisticIndex ? message : m)),
      });
    } else {
      set((state) => ({ messages: [...state.messages, message] }));
    }

    get().updateConversationLastMessage(message.conversationId, message);
  },

  removeMessage: (tempId) => {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== tempId) }));
  },

  markMessageFailed: (tempId) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? { ...m, _status: 'failed' } : m
      ),
    }));
  },

  replaceTempMessage: (tempId, realMessage) => {
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

      const sorted = [...conversations].sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      return { conversations: sorted };
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
    set({
      conversations: [],
      currentConversation: null,
      messages: [],
      typingUsers: new Map(),
      unreadMap: {},
      totalUnread: 0,
    });
  },
}));
