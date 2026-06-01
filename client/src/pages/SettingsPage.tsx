import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { IconLogout, IconEdit, IconX } from '../components/Icons';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateProfileOptimistic, logout } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [editingNickname, setEditingNickname] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [messagePreview, setMessagePreview] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed === user?.nickname) {
      setNickname(user?.nickname || '');
      setEditingNickname(false);
      return;
    }
    try {
      await updateProfileOptimistic({ nickname: trimmed });
      setEditingNickname(false);
      setToast({ message: '昵称已更新', type: 'success' });
    } catch {
      setNickname(user?.nickname || '');
      setEditingNickname(false);
      setToast({ message: '更新失败', type: 'error' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
        <h2 className="text-white font-display font-600 text-sm tracking-wide">设置</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">

        <GlassCard className="p-5">
          <h3 className="text-white font-display font-600 text-sm mb-4">账号信息</h3>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-biu-primary to-biu-secondary flex items-center justify-center text-white text-xl font-display font-700 shrink-0">
              {user?.nickname?.[0] || 'B'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {editingNickname ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNickname();
                        if (e.key === 'Escape') {
                          setNickname(user?.nickname || '');
                          setEditingNickname(false);
                        }
                      }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-lg glass-input text-white text-sm outline-none font-body"
                    />
                    <button
                      onClick={handleSaveNickname}
                      className="text-biu-primary hover:text-biu-primary-dim transition text-xs font-body"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setNickname(user?.nickname || '');
                        setEditingNickname(false);
                      }}
                      className="text-gray-500 hover:text-white transition"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-white font-display font-600 truncate">{user?.nickname}</p>
                    <button
                      onClick={() => setEditingNickname(true)}
                      className="text-gray-500 hover:text-biu-primary transition shrink-0"
                    >
                      <IconEdit size={12} />
                    </button>
                  </>
                )}
              </div>
              <p className="text-biu-primary/60 text-xs font-display mt-0.5">Biu号: {user?.biuId}</p>
              <p className="text-gray-600 text-xs font-body mt-0.5">@{user?.username}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-white font-display font-600 text-sm mb-4">消息</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-body">消息预览</p>
                <p className="text-gray-600 text-xs font-body mt-0.5">在会话列表中显示消息内容</p>
              </div>
              <button
                onClick={() => setMessagePreview(!messagePreview)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${messagePreview ? 'bg-biu-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${messagePreview ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-body">Markdown 渲染</p>
                <p className="text-gray-600 text-xs font-body mt-0.5">渲染消息中的 Markdown 格式</p>
              </div>
              <button
                onClick={() => setMarkdownEnabled(!markdownEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${markdownEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${markdownEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-white font-display font-600 text-sm mb-4">通知</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-body">消息通知</p>
                <p className="text-gray-600 text-xs font-body mt-0.5">接收新消息时弹出通知</p>
              </div>
              <button
                onClick={() => setNotificationEnabled(!notificationEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${notificationEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${notificationEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-body">提示音</p>
                <p className="text-gray-600 text-xs font-body mt-0.5">收到消息时播放提示音</p>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${soundEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${soundEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-white font-display font-600 text-sm mb-4">关于</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm font-body">版本</p>
              <p className="text-gray-600 text-sm font-body">1.0.0</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm font-body">构建</p>
              <p className="text-gray-600 text-sm font-body">Electron + React</p>
            </div>
          </div>
        </GlassCard>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition text-sm font-body flex items-center justify-center gap-2"
        >
          <IconLogout size={16} /> 退出登录
        </button>

      </div>
    </div>
  );
}
