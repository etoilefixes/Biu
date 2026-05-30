import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const items = [
    { path: '/chat', icon: '💬', label: '消息' },
    { path: '/contacts', icon: '📋', label: '联系人' },
    { path: '/profile', icon: '👤', label: '我的' },
  ];

  return (
    <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-6">
      <div className="w-10 h-10 rounded-full bg-biu-primary flex items-center justify-center text-white text-sm font-bold mb-4">
        {user?.nickname?.[0] || 'B'}
      </div>
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition ${
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
  );
}
