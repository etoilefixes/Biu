import { create } from 'zustand';
import { Conversation, Message } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  typingUsers: Map<string, string>;
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  sendMessage: (content: string, type?: string, senderId?: string) => void;
  addMessage: (message: Message) => void;
  removeMessage: (tempId: string) => void;
  markMessageFailed: (tempId: string) => void;
  replaceTempMessage: (tempId: string, realMessage: Message) => void;
  addConversationOptimistic: (conversation: Conversation) => void;
  replaceTempConversation: (tempId: string, realConversation: Conversation) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
}

let tempIdCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  typingUsers: new Map(),

  loadConversations: async () => {
    const res: any = await api.get('/conversations');
    set({ conversations: res.data });
  },

  selectConversation: async (conversation) => {
    set({ currentConversation: conversation, messages: [] });
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

    socketService.sendMessage({
      conversationId: currentConversation.id,
      content,
      type,
    });
  },

  addMessage: (message) => {
    const { messages } = get();
    const isOptimistic = messages.some(
      (m) =>
        (m as any)._status === 'sending' &&
        m.conversationId === message.conversationId &&
        m.content === message.content &&
        m.senderId === message.senderId
    );

    if (isOptimistic) {
      set({
        messages: messages.map((m) =>
          (m as any)._status === 'sending' &&
          m.conversationId === message.conversationId &&
          m.content === message.content &&
          m.senderId === message.senderId
            ? message
            : m
        ),
      });
    } else {
      set((state) => ({ messages: [...state.messages, message] }));
    }
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
}));
