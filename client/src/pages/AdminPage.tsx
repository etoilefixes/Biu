import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import AvatarWithBadge from '../components/AvatarWithBadge';
import { User } from '@biu/shared';

export default function AdminPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [loading, setLoading] = useState(false);

  const isOfficial = user?.role === 'official' || user?.role === 'admin';

  useEffect(() => {
    if (isOfficial) {
      loadUsers();
    }
  }, [isOfficial]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/official/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle || !broadcastContent) return;
    setLoading(true);
    try {
      await api.post('/official/broadcast', {
        title: broadcastTitle,
        content: broadcastContent,
      });
      setToast({ message: '广播发送成功', type: 'success' });
      setBroadcastTitle('');
      setBroadcastContent('');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetRole = async (userId: string, role: 'user' | 'admin' | 'official') => {
    try {
      await api.put(`/official/users/${userId}/role`, { role });
      setToast({ message: '角色更新成功', type: 'success' });
      await loadUsers();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？')) return;
    try {
      await api.delete(`/official/users/${userId}`);
      setToast({ message: '用户删除成功', type: 'success' });
      await loadUsers();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  if (!isOfficial) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">无权访问此页面</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center px-6 py-4 border-b border-white/5">
        <h1 className="text-white font-display font-600 text-sm tracking-wide">管理面板</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <GlassCard className="p-6">
          <h2 className="text-white font-display font-600 text-sm mb-4">发送系统广播</h2>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">标题</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                placeholder="广播标题"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">内容</label>
              <textarea
                value={broadcastContent}
                onChange={(e) => setBroadcastContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body min-h-[100px]"
                placeholder="广播内容"
              />
            </div>
            <button
              onClick={handleSendBroadcast}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-600 transition-all duration-200 hover:shadow-glow disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送广播'}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-white font-display font-600 text-sm mb-4">用户管理</h2>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <AvatarWithBadge
                  fallback={u.nickname?.[0] || 'B'}
                  badges={u.badges}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.nickname}</p>
                  <p className="text-gray-400 text-xs">{u.biuId} · {u.role}</p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => handleSetRole(u.id, e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm border-none outline-none"
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                  <option value="official">官方</option>
                </select>
                <button
                  onClick={() => handleDeleteUser(u.id)}
                  className="px-3 py-1.5 rounded-lg bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
