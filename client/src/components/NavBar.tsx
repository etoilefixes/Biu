import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { useChatStore } from '../store/chatStore';
import Toast from './Toast';
import { IconChat, IconContacts, IconLogout, IconEdit, IconSettings, IconX } from './Icons';
import AvatarWithBadge from './AvatarWithBadge';
import UserBadge from './UserBadge';

function formatBadge(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateProfileOptimistic, logout } = useAuthStore();
  const { pendingRequestCount } = useFriendStore();
  const totalUnread = useChatStore((s) => s.totalUnread);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messagePreview, setMessagePreview] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        if (editing) {
          handleSave();
        }
        setShowProfile(false);
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    }
    if (showProfile || showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile, showSettings, editing, nickname]);

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed === user?.nickname) {
      setNickname(user?.nickname || '');
      setEditing(false);
      return;
    }
    try {
      await updateProfileOptimistic({ nickname: trimmed });
      setEditing(false);
      setToast({ message: '昵称已更新', type: 'success' });
    } catch (err: any) {
      setNickname(user?.nickname || '');
      setEditing(false);
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setNickname(user?.nickname || '');
      setEditing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = [
    { path: '/chat', icon: <IconChat size={20} />, label: '消息' },
    { path: '/contacts', icon: <IconContacts size={20} />, label: '联系人' },
  ];
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showProfile && (
        <div
          ref={profileRef}
          className="fixed left-[76px] top-4 w-72 glass-strong rounded-2xl p-5 z-50 shadow-2xl animate-scale-in shadow-glow"
        >
          <div className="flex items-center gap-3 mb-5">
            <AvatarWithBadge
              fallback={user?.nickname?.[0] || 'B'}
              badges={user?.badges}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-white font-medium font-display truncate">{user?.nickname}</p>
                <UserBadge badges={user?.badges} size="sm" />
              </div>
              <p className="text-biu-primary/70 text-xs font-display">{user?.biuId}</p>
            </div>
          </div>
          <div className="mb-4 group">
            <div className="flex items-center justify-between">
              <label className="text-gray-500 text-xs font-medium">昵称</label>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-biu-primary transition"
                >
                  <IconEdit size={12} />
                </button>
              )}
            </div>
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-full mt-1 px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body"
              />
            ) : (
              <p
                onClick={() => setEditing(true)}
                className="text-white mt-1 text-sm cursor-pointer hover:text-biu-primary transition font-body border border-transparent px-3 py-2 rounded-lg"
              >
                {user?.nickname}
              </p>
            )}
          </div>
          <div className="pt-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition text-sm font-body"
            >
              <IconLogout size={14} /> 退出登录
            </button>
          </div>
        </div>
      )}
      {showSettings && (
        <div
          ref={settingsRef}
          className="fixed left-[76px] top-4 bottom-4 w-80 glass-strong rounded-2xl z-50 shadow-2xl animate-scale-in shadow-glow flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-white font-display font-600 text-sm">设置</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-500 hover:text-white transition"
            >
              <IconX size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-3">
              <AvatarWithBadge
                fallback={user?.nickname?.[0] || 'B'}
                badges={user?.badges}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white font-display font-600 text-sm truncate">{user?.nickname}</p>
                  <UserBadge badges={user?.badges} size="sm" />
                </div>
                <p className="text-biu-primary/60 text-[11px] font-display">{user?.biuId}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <h3 className="text-gray-500 text-xs font-medium mb-3">消息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-body">消息预览</p>
                    <p className="text-gray-600 text-[11px] font-body">在会话列表中显示消息内容</p>
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
                    <p className="text-gray-600 text-[11px] font-body">渲染消息中的 Markdown 格式</p>
                  </div>
                  <button
                    onClick={() => setMarkdownEnabled(!markdownEnabled)}
                    className={`w-10 h-6 rounded-full transition-all duration-200 relative ${markdownEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${markdownEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <h3 className="text-gray-500 text-xs font-medium mb-3">通知</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-body">消息通知</p>
                    <p className="text-gray-600 text-[11px] font-body">接收新消息时弹出通知</p>
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
                    <p className="text-gray-600 text-[11px] font-body">收到消息时播放提示音</p>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-10 h-6 rounded-full transition-all duration-200 relative ${soundEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${soundEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <h3 className="text-gray-500 text-xs font-medium mb-3">关于</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm font-body">版本</p>
                  <p className="text-gray-600 text-sm font-body">1.0.0</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm font-body">构建</p>
                  <p className="text-gray-600 text-sm font-body">Electron + React</p>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition text-sm font-body flex items-center justify-center gap-2"
            >
              <IconLogout size={14} /> 退出登录
            </button>
          </div>
        </div>
      )}
      <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-2">
        <button
          ref={avatarRef}
          onClick={() => { setShowProfile(!showProfile); setShowSettings(false); }}
          className={`relative mb-4 transition-all duration-200 ${
            showProfile ? 'ring-2 ring-biu-primary shadow-glow' : 'hover:shadow-glow hover:scale-105'
          }`}
        >
          <AvatarWithBadge
            fallback={user?.nickname?.[0] || 'B'}
            badges={user?.badges}
            size="md"
          />
        </button>
        {items.map((item) => {
          const badge = item.path === '/chat'
            ? formatBadge(totalUnread)
            : item.path === '/contacts'
              ? formatBadge(pendingRequestCount)
              : '';
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                location.pathname === item.path
                  ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
              title={item.label}
            >
              {item.icon}
              {badge && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          ref={settingsBtnRef}
          onClick={() => { setShowSettings(!showSettings); setShowProfile(false); }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
            showSettings
              ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
          title="设置"
        >
          <IconSettings size={20} />
        </button>
      </div>
    </>
  );
}
