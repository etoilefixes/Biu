import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import NavBar from '../components/NavBar';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

export default function ProfilePage() {
  const { user, loadUser, logout } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    try {
      await api.put('/users/profile', { nickname });
      await loadUser();
      setEditing(false);
      setToast({ message: '更新成功', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="flex h-screen gradient-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <NavBar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">个人资料</h1>
        <GlassCard className="max-w-lg p-6 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-biu-primary flex items-center justify-center text-white text-2xl font-bold">
              {user?.nickname?.[0] || 'B'}
            </div>
            <div>
              <p className="text-white text-lg font-medium">{user?.nickname}</p>
              <p className="text-gray-500 text-sm">@{user?.username}</p>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm">昵称</label>
            {editing ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full mt-1 px-4 py-2 rounded-lg glass-input text-white outline-none focus:border-biu-primary transition"
              />
            ) : (
              <p className="text-white mt-1">{user?.nickname}</p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-biu-primary hover:bg-biu-secondary text-white transition"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg glass text-gray-400 hover:text-white transition"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-lg bg-biu-primary/20 text-biu-secondary hover:bg-biu-primary/40 transition"
              >
                编辑资料
              </button>
            )}
          </div>
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition"
            >
              退出登录
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
