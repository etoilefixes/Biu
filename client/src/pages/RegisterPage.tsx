import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import GlassCard from '../components/GlassCard';
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GlassCard className="w-96 p-8 animate-scale-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Biu</h1>
          <p className="text-gray-400 text-sm">创建新账号</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="text-center text-gray-400 text-sm mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-biu-secondary hover:text-white transition">
            登录
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
