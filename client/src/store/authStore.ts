import { create } from 'zustand';
import { User } from '@biu/shared';
import api from '../services/api';
import { socketService } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfileOptimistic: (data: { nickname?: string; avatar?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('biu_token'),
  isAuthenticated: !!localStorage.getItem('biu_token'),

  login: async (username, password) => {
    const res: any = await api.post('/auth/login', { username, password });
    const { token, user } = res.data;
    localStorage.setItem('biu_token', token);
    socketService.connect(token);
    set({ user, token, isAuthenticated: true });
  },

  register: async (username, password, nickname) => {
    const res: any = await api.post('/auth/register', { username, password, nickname });
    const { token, user } = res.data;
    localStorage.setItem('biu_token', token);
    socketService.connect(token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('biu_token');
    socketService.disconnect();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const res: any = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('biu_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  updateProfileOptimistic: async (data) => {
    const previousUser = get().user;
    if (previousUser) {
      set({ user: { ...previousUser, ...data } });
    }
    try {
      await api.put('/users/profile', data);
    } catch {
      set({ user: previousUser });
      throw new Error('更新失败');
    }
  },
}));
