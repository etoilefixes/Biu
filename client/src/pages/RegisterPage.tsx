import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast from '../components/Toast';
import TitleBar from '../components/TitleBar';

interface FieldErrors {
  username?: string;
  nickname?: string;
  password?: string;
}

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!username.trim()) {
      errs.username = '请输入用户名';
    } else if (username.length < 3) {
      errs.username = '用户名至少3个字符';
    } else if (username.length > 20) {
      errs.username = '用户名最多20个字符';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errs.username = '用户名只能包含字母、数字和下划线';
    }

    if (!nickname.trim()) {
      errs.nickname = '请输入昵称';
    } else if (nickname.trim().length > 20) {
      errs.nickname = '昵称最多20个字符';
    }

    if (!password) {
      errs.password = '请输入密码';
    } else if (password.length < 6) {
      errs.password = '密码至少6个字符';
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

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

  const clearFieldError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="flex flex-col h-screen gradient-bg page-transition">
      <div className="noise-overlay" />
      <TitleBar />
      <div className="flex items-center justify-center flex-1">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="w-[400px] animate-scale-in">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl font-800 text-white mb-3 tracking-tightest">
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
                placeholder="输入用户名（3-20位字母数字下划线）"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
                className={`w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body ${
                  errors.username ? 'border-red-500/50' : ''
                }`}
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1.5 font-body">{errors.username}</p>
              )}
            </div>
            <div className="animate-slide-up stagger-2" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">昵称</label>
              <input
                type="text"
                placeholder="你的昵称"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); clearFieldError('nickname'); }}
                className={`w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body ${
                  errors.nickname ? 'border-red-500/50' : ''
                }`}
              />
              {errors.nickname && (
                <p className="text-red-400 text-xs mt-1.5 font-body">{errors.nickname}</p>
              )}
            </div>
            <div className="animate-slide-up stagger-3" style={{ opacity: 0, animationFillMode: 'forwards' }}>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">密码</label>
              <input
                type="password"
                placeholder="设置密码（至少6位）"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                className={`w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body ${
                  errors.password ? 'border-red-500/50' : ''
                }`}
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5 font-body">{errors.password}</p>
              )}
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
    </div>
  );
}
