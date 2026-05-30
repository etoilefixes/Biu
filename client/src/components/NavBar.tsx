import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import Toast from './Toast';
import { IconChat, IconContacts, IconEdit, IconLogout, IconCheck, IconX } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadUser, logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setShowProfile(false);
        setEditing(false);
      }
    }
    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile]);

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
          className="fixed left-[72px] top-4 w-72 glass-strong rounded-2xl p-5 z-50 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-biu-primary flex items-center justify-center text-white text-lg font-bold">
              {user?.nickname?.[0] || 'B'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.nickname}</p>
              <p className="text-gray-500 text-xs">@{user?.username}</p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-gray-400 text-xs">昵称</label>
            {editing ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg glass-input text-white text-sm outline-none focus:border-biu-primary transition"
              />
            ) : (
              <p className="text-white mt-1 text-sm">{user?.nickname}</p>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-biu-primary hover:bg-biu-secondary text-white text-sm transition"
                >
                  <IconCheck size={14} /> 保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-gray-400 hover:text-white text-sm transition"
                >
                  <IconX size={14} /> 取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-biu-primary/20 text-biu-secondary hover:bg-biu-primary/40 text-sm transition"
              >
                <IconEdit size={14} /> 编辑资料
              </button>
            )}
          </div>
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 text-sm transition"
            >
              <IconLogout size={14} /> 退出登录
            </button>
          </div>
        </div>
      )}
      <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-6">
        <button
          ref={avatarRef}
          onClick={() => setShowProfile(!showProfile)}
          className={`w-10 h-10 rounded-xl bg-biu-primary flex items-center justify-center text-white text-sm font-bold mb-4 transition ${
            showProfile ? 'ring-2 ring-biu-secondary' : 'hover:ring-2 hover:ring-biu-secondary/50'
          }`}
        >
          {user?.nickname?.[0] || 'B'}
        </button>
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
              location.pathname === item.path
                ? 'bg-biu-primary/30 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
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
