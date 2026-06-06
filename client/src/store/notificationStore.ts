import { create } from 'zustand';
import api from '../services/api';

interface NotificationSettingItem {
  id: string;
  userId: string;
  conversationId: string;
  muted: boolean;
  showPreview: boolean;
}

interface NotificationState {
  // 全局设置（localStorage）
  globalEnabled: boolean;
  soundEnabled: boolean;
  showPreview: boolean;
  // 按会话设置（数据库）
  conversationSettings: NotificationSettingItem[];
  // 操作
  setGlobalEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setShowPreview: (enabled: boolean) => void;
  loadConversationSettings: () => Promise<void>;
  setConversationMuted: (conversationId: string, muted: boolean) => Promise<void>;
  setConversationShowPreview: (conversationId: string, showPreview: boolean) => Promise<void>;
  isConversationMuted: (conversationId: string) => boolean;
  isConversationShowPreview: (conversationId: string) => boolean;
}

const STORAGE_KEY = 'biu_notification_settings';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { globalEnabled: true, soundEnabled: true, showPreview: true };
}

function saveToStorage(data: { globalEnabled: boolean; soundEnabled: boolean; showPreview: boolean }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const stored = loadFromStorage();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  globalEnabled: stored.globalEnabled,
  soundEnabled: stored.soundEnabled,
  showPreview: stored.showPreview,
  conversationSettings: [],

  setGlobalEnabled: (enabled) => {
    set({ globalEnabled: enabled });
    saveToStorage({ ...get(), globalEnabled: enabled });
  },

  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled });
    saveToStorage({ ...get(), soundEnabled: enabled });
  },

  setShowPreview: (enabled) => {
    set({ showPreview: enabled });
    saveToStorage({ ...get(), showPreview: enabled });
  },

  loadConversationSettings: async () => {
    try {
      const res: any = await api.get('/notifications');
      set({ conversationSettings: res.data });
    } catch {
      // 静默失败
    }
  },

  setConversationMuted: async (conversationId, muted) => {
    try {
      const res: any = await api.post('/notifications', { conversationId, muted });
      set((state) => {
        const existing = state.conversationSettings.findIndex(
          (s) => s.conversationId === conversationId
        );
        if (existing !== -1) {
          const updated = [...state.conversationSettings];
          updated[existing] = res.data;
          return { conversationSettings: updated };
        }
        return { conversationSettings: [...state.conversationSettings, res.data] };
      });
    } catch {
      // 静默失败
    }
  },

  setConversationShowPreview: async (conversationId, showPreview) => {
    try {
      const res: any = await api.post('/notifications', { conversationId, showPreview });
      set((state) => {
        const existing = state.conversationSettings.findIndex(
          (s) => s.conversationId === conversationId
        );
        if (existing !== -1) {
          const updated = [...state.conversationSettings];
          updated[existing] = res.data;
          return { conversationSettings: updated };
        }
        return { conversationSettings: [...state.conversationSettings, res.data] };
      });
    } catch {
      // 静默失败
    }
  },

  isConversationMuted: (conversationId) => {
    const setting = get().conversationSettings.find(
      (s) => s.conversationId === conversationId
    );
    return setting?.muted ?? false;
  },

  isConversationShowPreview: (conversationId) => {
    const setting = get().conversationSettings.find(
      (s) => s.conversationId === conversationId
    );
    return setting?.showPreview ?? get().showPreview;
  },
}));
