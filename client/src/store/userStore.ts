import { create } from 'zustand';
import api from '../services/api';

interface UserStore {
  avatar: string;
  setAvatar: (avatar: string) => void;
  updateProfile: (data: { nickname?: string; avatar?: string }) => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  avatar: '',
  setAvatar: (avatar) => set({ avatar }),
  updateProfile: async (data) => {
    const res: any = await api.put('/users/profile', data);
    set({ avatar: res.data.avatar });
  },
}));
