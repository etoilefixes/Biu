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
  sendMessage: (content: string, type?: string) => void;
  addMessage: (message: Message) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
}

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

  sendMessage: (content, type = 'text') => {
    const { currentConversation } = get();
    if (!currentConversation) return;
    socketService.sendMessage({
      conversationId: currentConversation.id,
      content,
      type,
    });
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
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
