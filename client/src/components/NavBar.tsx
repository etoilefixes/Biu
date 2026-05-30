import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast from './Toast';
import { IconChat, IconContacts, IconLogout, IconEdit } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateProfileOptimistic, logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }
    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile, editing, nickname]);

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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-biu-primary to-biu-secondary flex items-center justify-center text-white text-lg font-display font-700">
              {user?.nickname?.[0] || 'B'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium font-display truncate">{user?.nickname}</p>
              <p className="text-gray-500 text-xs">@{user?.username}</p>
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
      <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-2">
        <button
          ref={avatarRef}
          onClick={() => setShowProfile(!showProfile)}
          className={`w-10 h-10 rounded-xl bg-gradient-to-br from-biu-primary to-biu-secondary flex items-center justify-center text-white text-sm font-display font-700 mb-4 transition-all duration-200 ${
            showProfile ? 'ring-2 ring-biu-primary shadow-glow' : 'hover:shadow-glow hover:scale-105'
          }`}
        >
          {user?.nickname?.[0] || 'B'}
        </button>
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              location.pathname === item.path
                ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </>
  );
}
