import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import Toast from './Toast';
import { IconChat, IconContacts, IconLogout, IconEdit, IconSettings, IconX, IconCrown, IconRobot } from './Icons';
import AvatarWithBadge from './AvatarWithBadge';
import UserBadge from './UserBadge';
import AiRoleModal from './AiRoleModal';
import ContactsPanel from './ContactsPanel';
import AdminPanel from './AdminPanel';
import api from '../services/api';

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
  const [showAiRoleModal, setShowAiRoleModal] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messagePreview, setMessagePreview] = useState(true);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai'>('general');

  const { globalEnabled: notificationEnabled, setGlobalEnabled: setNotificationEnabled, soundEnabled, setSoundEnabled, showPreview: notifShowPreview } = useNotificationStore();

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
  ];

  const isOfficial = user?.role === 'admin' || user?.role === 'super_admin';
  const isAIUser = user?.username === 'biu_ai' || user?.badges?.some((b) => b.type === 'AI');
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
          {/* Tab 切换 */}
          <div className="flex px-5 pt-3 gap-1">
            <button
              onClick={() => setSettingsTab('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-body transition ${
                settingsTab === 'general' ? 'bg-biu-primary/15 text-biu-primary' : 'text-gray-500 hover:text-white'
              }`}
            >
              通用
            </button>
            <button
              onClick={() => setSettingsTab('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-body transition ${
                settingsTab === 'ai' ? 'bg-biu-primary/15 text-biu-primary' : 'text-gray-500 hover:text-white'
              }`}
            >
              AI 设置
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {settingsTab === 'general' ? (
              <>
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
                    <p className="text-white text-sm font-body">通知预览</p>
                    <p className="text-gray-600 text-[11px] font-body">在通知中显示消息内容</p>
                  </div>
                  <button
                    onClick={() => useNotificationStore.getState().setShowPreview(!notifShowPreview)}
                    className={`w-10 h-6 rounded-full transition-all duration-200 relative ${notifShowPreview ? 'bg-biu-primary' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${notifShowPreview ? 'left-5' : 'left-1'}`} />
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
              </>
            ) : (
              <AiSettingsPanel />
            )}
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
        <button
          onClick={() => setShowContacts(!showContacts)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
            showContacts
              ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
          title="联系人"
        >
          <IconContacts size={20} />
          {pendingRequestCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none">
              {formatBadge(pendingRequestCount)}
            </span>
          )}
        </button>
        {isAIUser && (
          <button
            onClick={() => navigate('/ai-chat')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              location.pathname === '/ai-chat'
                ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            title="AI 工作台"
          >
            <IconRobot size={20} />
          </button>
        )}
        {isOfficial && (
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              showAdmin
                ? 'bg-biu-primary/15 text-biu-primary shadow-glow'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            title="管理面板"
          >
            <IconCrown size={20} />
          </button>
        )}
        <div className="flex-1" />
        {!isAIUser && (
          <button
            onClick={() => setShowAiRoleModal(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 text-gray-500 hover:text-white hover:bg-white/5"
            title="AI 角色"
          >
            <IconRobot size={20} />
          </button>
        )}
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
      {showAiRoleModal && (
        <AiRoleModal onClose={() => setShowAiRoleModal(false)} />
      )}
      {showContacts && (
        <ContactsPanel onClose={() => setShowContacts(false)} />
      )}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </>
  );
}

/** AI 设置面板 */
function AiSettingsPanel() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // 表单状态
  const [provider, setProvider] = useState('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [reasoningModel, setReasoningModel] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState('none');
  const [reasoningDisplay, setReasoningDisplay] = useState('hidden');
  const [reasoningEffort, setReasoningEffort] = useState('high');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/ai-roles/config/model');
      const data = res.data;
      setConfig(data);
      setProvider(data.provider || 'openai-compatible');
      setBaseUrl(data.baseUrl || '');
      setChatModel(data.chatModel || '');
      setReasoningModel(data.reasoningModel || '');
      setReasoningEnabled(data.reasoningEnabled || false);
      setReasoningMode(data.reasoningMode || 'none');
      setReasoningDisplay(data.reasoningDisplay || 'hidden');
      setReasoningEffort(data.reasoningEffort || 'high');
      setStreamingEnabled(data.streamingEnabled ?? true);
      setTemperature(data.temperature ?? 0.7);
      setMaxTokens(data.maxTokens ?? 2000);
    } catch (err: any) {
      setToast({ message: '加载配置失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/ai-roles/config/model', {
        provider,
        baseUrl,
        apiKey: apiKey || undefined,
        chatModel,
        reasoningModel: reasoningModel || null,
        reasoningEnabled,
        reasoningMode,
        reasoningDisplay,
        reasoningEffort,
        streamingEnabled,
        temperature,
        maxTokens,
      });
      setApiKey(''); // 清空，不保留在前端
      setToast({ message: '保存成功', type: 'success' });
      await loadConfig();
    } catch (err: any) {
      setToast({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res: any = await api.post('/ai-roles/config/test', {
        provider,
        baseUrl,
        apiKey,
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500 text-sm font-body">加载中...</p></div>;
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h3 className="text-gray-500 text-xs font-medium mb-3">服务商</h3>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body bg-transparent"
        >
          <option value="openai-compatible" className="bg-biu-dark">OpenAI Compatible</option>
          <option value="deepseek" className="bg-biu-dark">DeepSeek</option>
          <option value="qwen" className="bg-biu-dark">通义千问</option>
          <option value="ollama" className="bg-biu-dark">Ollama (本地)</option>
        </select>
      </div>

      <div>
        <label className="text-gray-500 text-xs font-medium mb-1 block">接口地址 (Base URL)</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.deepseek.com/v1"
          className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
        />
      </div>

      <div>
        <label className="text-gray-500 text-xs font-medium mb-1 block">
          API Key {config?.hasApiKey && <span className="text-biu-primary">(已配置)</span>}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config?.hasApiKey ? '••••••••（留空保持不变）' : '输入 API Key'}
          className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
        />
      </div>

      <div>
        <label className="text-gray-500 text-xs font-medium mb-1 block">默认聊天模型</label>
        <input
          type="text"
          value={chatModel}
          onChange={(e) => setChatModel(e.target.value)}
          placeholder="deepseek-chat"
          className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
        />
      </div>

      <div className="pt-3 border-t border-white/5">
        <h3 className="text-gray-500 text-xs font-medium mb-3">思考模型</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-body">启用思考模型</p>
              <p className="text-gray-600 text-[11px] font-body">启用 DeepSeek thinking 推理模式</p>
            </div>
            <button
              onClick={() => setReasoningEnabled(!reasoningEnabled)}
              className={`w-10 h-6 rounded-full transition-all duration-200 relative ${reasoningEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${reasoningEnabled ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
          {reasoningEnabled && (
            <>
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">思考模型名称</label>
                <input
                  type="text"
                  value={reasoningModel}
                  onChange={(e) => setReasoningModel(e.target.value)}
                  placeholder="留空则使用默认聊天模型"
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">推理强度 (reasoning_effort)</label>
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body bg-transparent"
                >
                  <option value="low" className="bg-biu-dark">低 (low)</option>
                  <option value="medium" className="bg-biu-dark">中 (medium)</option>
                  <option value="high" className="bg-biu-dark">高 (high)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">思考内容展示</label>
                <select
                  value={reasoningDisplay}
                  onChange={(e) => setReasoningDisplay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body bg-transparent"
                >
                  <option value="hidden" className="bg-biu-dark">隐藏</option>
                  <option value="visible" className="bg-biu-dark">折叠显示</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-white/5">
        <h3 className="text-gray-500 text-xs font-medium mb-3">高级参数</h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">
              创造性 (Temperature): {temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-biu-primary"
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-body mt-0.5">
              <span>精确</span>
              <span>创造</span>
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">最大回复长度 (maxTokens)</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
              min={100}
              max={8000}
              className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-body">流式输出</p>
              <p className="text-gray-600 text-[11px] font-body">逐字输出回复（暂未实现）</p>
            </div>
            <button
              onClick={() => setStreamingEnabled(!streamingEnabled)}
              className={`w-10 h-6 rounded-full transition-all duration-200 relative ${streamingEnabled ? 'bg-biu-primary' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${streamingEnabled ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 连接测试 */}
      <div className="pt-3 border-t border-white/5">
        <button
          onClick={handleTest}
          disabled={testing || !baseUrl}
          className="w-full py-2 rounded-lg bg-white/5 text-gray-300 text-sm font-body hover:bg-white/10 transition disabled:opacity-30"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
        {testResult && (
          <div className={`mt-2 p-2 rounded-lg text-xs font-body ${testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {testResult.message}
            {testResult.models && testResult.models.length > 0 && (
              <div className="mt-1 text-gray-500">
                可用模型: {testResult.models.slice(0, 5).join(', ')}{testResult.models.length > 5 ? '...' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 保存 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-biu-primary text-biu-dark text-sm font-body font-500 hover:bg-biu-primary-dim transition disabled:opacity-30"
      >
        {saving ? '保存中...' : '保存配置'}
      </button>

      {config?.source === 'env' && (
        <p className="text-gray-600 text-[11px] font-body text-center">当前配置来自环境变量，保存后将存入数据库</p>
      )}
    </div>
  );
}
