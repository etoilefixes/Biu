import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import AvatarWithBadge from '../components/AvatarWithBadge';

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
    <div className="flex-1 flex flex-col min-h-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center px-6 py-4 border-b border-white/5">
        <h1 className="text-white font-display font-600 text-sm tracking-wide">个人资料</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <GlassCard className="max-w-lg p-6 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <AvatarWithBadge
              fallback={user?.nickname?.[0] || 'B'}
              badges={user?.badges}
              size="lg"
            />
            <div>
              <p className="text-white text-lg font-medium font-display">{user?.nickname}</p>
              <p className="text-biu-primary/60 text-sm font-display">{user?.biuId}</p>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">昵称</label>
            {editing ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            ) : (
              <p className="text-white mt-1 font-body">{user?.nickname}</p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-600 transition-all duration-200 hover:shadow-glow"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 rounded-xl glass text-gray-400 hover:text-white transition"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2.5 rounded-xl bg-biu-primary/15 text-biu-primary hover:bg-biu-primary/25 transition font-display font-500"
              >
                编辑资料
              </button>
            )}
          </div>
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={logout}
              className="px-4 py-2.5 rounded-xl bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition text-sm font-body"
            >
              退出登录
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
