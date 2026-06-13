import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast from '../components/Toast';
import TitleBar from '../components/TitleBar';

export default function LoginPage() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(account, password);
      navigate('/chat');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen gradient-bg page-transition">
      <div className="noise-overlay" />
      <TitleBar />
      <div className="flex items-center justify-center flex-1">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="w-[400px] animate-scale-in">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-biu-primary/10 border border-biu-primary/20 mb-5">
            <span className="font-display text-3xl font-800 text-biu-primary">B</span>
          </div>
          <h1 className="font-display text-5xl-display font-800 text-white mb-2.5 tracking-tightest">
            <span className="text-biu-primary">B</span>iu
          </h1>
          <p className="text-gray-500 text-sm font-body tracking-wide">登录你的账号</p>
        </div>
        <div className="glass-strong rounded-2xl p-8 shadow-surface-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-slide-up stagger-1" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-2 block tracking-wide">用户名 / Biu号</label>
              <input
                type="text"
                placeholder="输入用户名或 Biu号"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="animate-slide-up stagger-2" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-2 block tracking-wide">密码</label>
              <input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="animate-slide-up stagger-3" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-700 text-sm tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-glow-strong hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    登录中...
                  </span>
                ) : '登 录'}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-gray-500 text-sm mt-8 animate-slide-up stagger-4" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          还没有账号？{' '}
          <Link to="/register" className="text-biu-primary hover:text-white transition font-medium">
            注册
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}
