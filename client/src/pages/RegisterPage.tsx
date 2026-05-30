import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast from '../components/Toast';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(username, password, nickname);
      navigate('/chat');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen gradient-bg page-transition">
      <div className="noise-overlay" />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="w-[400px] animate-scale-in">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl font-800 text-white mb-3 tracking-tight">
            <span className="text-biu-primary">B</span>iu
          </h1>
          <p className="text-gray-500 text-sm font-body">创建新账号</p>
        </div>
        <div className="glass-strong rounded-2xl p-8 shadow-glow">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-slide-up stagger-1" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">用户名</label>
              <input
                type="text"
                placeholder="输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="animate-slide-up stagger-2" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">昵称</label>
              <input
                type="text"
                placeholder="你的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="animate-slide-up stagger-3" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">密码</label>
              <input
                type="password"
                placeholder="设置密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="animate-slide-up stagger-4" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-700 text-sm tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-glow-strong"
              >
                {loading ? '注册中...' : '注 册'}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-gray-500 text-sm mt-8">
          已有账号？{' '}
          <Link to="/login" className="text-biu-primary hover:text-white transition font-medium">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
