import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import Toast from './Toast';
import { IconChat, IconContacts, IconLogout, IconEdit, IconSettings, IconX, IconCrown, IconRobot, IconPlus, IconTrash, IconRefresh, IconCheck } from './Icons';
import GlassCard from './GlassCard';
import GlassConfirm from './GlassConfirm';
import GlassSelect from './GlassSelect';
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

  const [messagePreview, setMessagePreview] = useState(() => {
    const stored = localStorage.getItem('biu_messagePreview');
    return stored !== null ? stored === 'true' : true;
  });
  const [markdownEnabled, setMarkdownEnabled] = useState(() => {
    const stored = localStorage.getItem('biu_markdownEnabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai'>('general');

  const { globalEnabled: notificationEnabled, setGlobalEnabled: setNotificationEnabled, soundEnabled, setSoundEnabled, showPreview: notifShowPreview } = useNotificationStore();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // 持久化设置到 localStorage
  useEffect(() => {
    localStorage.setItem('biu_messagePreview', String(messagePreview));
  }, [messagePreview]);

  useEffect(() => {
    localStorage.setItem('biu_markdownEnabled', String(markdownEnabled));
  }, [markdownEnabled]);

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
          className="fixed left-[76px] top-4 w-72 glass-strong rounded-2xl p-5 z-50 shadow-surface-xl animate-scale-in"
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
          className="fixed left-[76px] top-4 bottom-4 w-80 glass-strong rounded-2xl z-50 shadow-surface-xl animate-scale-in flex flex-col overflow-hidden"
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
      <div className="w-[60px] h-full glass flex flex-col items-center py-4 gap-1.5">
        <button
          ref={avatarRef}
          onClick={() => { setShowProfile(!showProfile); setShowSettings(false); }}
          className={`relative mb-3 transition-all duration-200 rounded-xl ${
            showProfile ? 'ring-2 ring-biu-primary shadow-glow' : 'hover:shadow-glow-subtle hover:scale-105'
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
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative group ${
                location.pathname === item.path
                  ? 'bg-biu-primary/12 text-biu-primary shadow-glow-subtle'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={item.label}
            >
              {item.icon}
              {badge && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none shadow-sm">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowContacts(!showContacts)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative group ${
            showContacts
              ? 'bg-biu-primary/12 text-biu-primary shadow-glow-subtle'
              : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="联系人"
        >
          <IconContacts size={20} />
          {pendingRequestCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none shadow-sm">
              {formatBadge(pendingRequestCount)}
            </span>
          )}
        </button>
        {isAIUser && (
          <button
            onClick={() => navigate('/ai-chat')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              location.pathname === '/ai-chat'
                ? 'bg-biu-primary/12 text-biu-primary shadow-glow-subtle'
                : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
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
                ? 'bg-biu-primary/12 text-biu-primary shadow-glow-subtle'
                : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
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
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 text-gray-500 hover:text-white hover:bg-white/[0.06]"
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
              ? 'bg-biu-primary/12 text-biu-primary shadow-glow-subtle'
              : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
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
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // 模型库
  const [models, setModels] = useState<any[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 用途选择
  const [chatModelId, setChatModelId] = useState<string>('');
  const [reasoningModelId, setReasoningModelId] = useState<string>('');
  const [arbitrationModelId, setArbitrationModelId] = useState<string>('');

  // 行为配置
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState('none');
  const [reasoningDisplay, setReasoningDisplay] = useState('hidden');
  const [reasoningEffort, setReasoningEffort] = useState('high');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [contextMessageLimit, setContextMessageLimit] = useState(20);
  const [arbitrationMaxTokens, setArbitrationMaxTokens] = useState(200);
  const [includePrivateContext, setIncludePrivateContext] = useState(false);
  const [aiTriggerMode, setAiTriggerMode] = useState<'always' | 'mention' | 'smart'>('always');

  // 模型编辑弹窗
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [modelForm, setModelForm] = useState({
    name: '',
    provider: 'openai-compatible',
    baseUrl: '',
    apiKey: '',
    modelName: '',
    maxTokens: 2000,
    temperature: 0.7,
  });
  const [modelFormSaving, setModelFormSaving] = useState(false);
  const [remoteModels, setRemoteModels] = useState<string[]>([]);
  const [remoteModelsLoading, setRemoteModelsLoading] = useState(false);

  // 测试状态
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ modelId: string; success: boolean; message: string; models?: string[] } | null>(null);

  // 删除确认
  const [deleteModelConfirm, setDeleteModelConfirm] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, modelsRes]: any[] = await Promise.all([
        api.get('/ai-roles/config/model'),
        api.get('/ai-roles/models'),
      ]);
      const cfg = configRes.data ?? configRes;
      const mdlList = modelsRes.data ?? modelsRes;
      setConfig(cfg);
      setModels(Array.isArray(mdlList) ? mdlList : []);
      setChatModelId(cfg.chatModel?.id || '');
      setReasoningModelId(cfg.reasoningModel?.id || '');
      setArbitrationModelId(cfg.arbitrationModel?.id || '');
      setReasoningEnabled(cfg.reasoningEnabled || false);
      setReasoningMode(cfg.reasoningMode || 'none');
      setReasoningDisplay(cfg.reasoningDisplay || 'hidden');
      setReasoningEffort(cfg.reasoningEffort || 'high');
      setStreamingEnabled(cfg.streamingEnabled ?? true);
      setContextMessageLimit(cfg.contextMessageLimit ?? 20);
      setArbitrationMaxTokens(cfg.arbitrationMaxTokens ?? 200);
      setIncludePrivateContext(cfg.includePrivateContext ?? false);
      setAiTriggerMode(cfg.aiTriggerMode || 'always');
    } catch (err: any) {
      setToast({ message: '加载配置失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      const res: any = await api.get('/ai-roles/models');
      const data = res.data ?? res;
      setModels(Array.isArray(data) ? data : []);
    } catch {
      setToast({ message: '加载模型列表失败', type: 'error' });
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!chatModelId) {
      setToast({ message: '请选择聊天模型', type: 'error' });
      return;
    }
    try {
      setSaving(true);
      await api.put('/ai-roles/config/model', {
        chatModelId,
        reasoningModelId: reasoningModelId || null,
        arbitrationModelId: arbitrationModelId || null,
        reasoningEnabled,
        reasoningMode,
        reasoningDisplay,
        reasoningEffort,
        streamingEnabled,
        contextMessageLimit,
        arbitrationMaxTokens,
        includePrivateContext,
        aiTriggerMode,
      });
      setToast({ message: '保存成功', type: 'success' });
      await loadData();
    } catch (err: any) {
      setToast({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 获取远程模型列表
  const fetchRemoteModels = async (baseUrl: string, apiKey: string, modelId?: string) => {
    if (!baseUrl.trim() && !modelId) {
      setRemoteModels([]);
      return;
    }
    // 新增时必须同时有 url 和 key
    if (!modelId && (!baseUrl.trim() || !apiKey.trim())) {
      setRemoteModels([]);
      return;
    }
    try {
      setRemoteModelsLoading(true);
      const body: any = {};
      if (modelId && !apiKey.trim()) {
        body.modelId = modelId;
      } else {
        body.baseUrl = baseUrl.trim();
        body.apiKey = apiKey.trim();
      }
      const res: any = await api.post('/ai-roles/models/fetch-remote', body);
      const data = res.data ?? res;
      if (data.success && Array.isArray(data.models)) {
        setRemoteModels(data.models);
      } else {
        setRemoteModels([]);
      }
    } catch {
      setRemoteModels([]);
    } finally {
      setRemoteModelsLoading(false);
    }
  };

  // URL 和 Key 同时存在时自动获取模型列表
  useEffect(() => {
    if (!showModelForm) return;
    if (editingModel?.id) {
      // 编辑模式：有 modelId 即可获取（后端用已存 key）
      if (!modelForm.baseUrl.trim()) return;
      const timer = setTimeout(() => {
        fetchRemoteModels(modelForm.baseUrl, modelForm.apiKey, editingModel.id);
      }, 600);
      return () => clearTimeout(timer);
    }
    // 新增模式：必须 url + key 都有
    if (!modelForm.baseUrl.trim() || !modelForm.apiKey.trim()) {
      setRemoteModels([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchRemoteModels(modelForm.baseUrl, modelForm.apiKey);
    }, 600);
    return () => clearTimeout(timer);
  }, [showModelForm, modelForm.baseUrl, modelForm.apiKey]);

  // 模型 CRUD
  const openAddModel = () => {
    setEditingModel(null);
    setModelForm({ name: '', provider: 'openai-compatible', baseUrl: '', apiKey: '', modelName: '', maxTokens: 2000, temperature: 0.7 });
    setRemoteModels([]);
    setShowModelForm(true);
  };

  const openEditModel = (m: any) => {
    setEditingModel(m);
    setModelForm({
      name: m.name || '',
      provider: m.provider || 'openai-compatible',
      baseUrl: m.baseUrl || '',
      apiKey: '',
      modelName: m.modelName || '',
      maxTokens: m.maxTokens ?? 2000,
      temperature: m.temperature ?? 0.7,
    });
    setShowModelForm(true);
  };

  const handleModelFormSave = async () => {
    if (!modelForm.name.trim() || !modelForm.modelName.trim() || !modelForm.baseUrl.trim()) {
      setToast({ message: '请填写名称、接口地址和模型标识', type: 'error' });
      return;
    }
    try {
      setModelFormSaving(true);
      const body: any = {
        name: modelForm.name.trim(),
        provider: modelForm.provider,
        baseUrl: modelForm.baseUrl.trim(),
        modelName: modelForm.modelName.trim(),
        maxTokens: modelForm.maxTokens,
        temperature: modelForm.temperature,
      };
      if (modelForm.apiKey) body.apiKey = modelForm.apiKey;
      if (editingModel) {
        await api.put(`/ai-roles/models/${editingModel.id}`, body);
        setToast({ message: '模型已更新', type: 'success' });
      } else {
        await api.post('/ai-roles/models', body);
        setToast({ message: '模型已添加', type: 'success' });
      }
      setShowModelForm(false);
      await loadModels();
    } catch (err: any) {
      setToast({ message: err.message || '保存模型失败', type: 'error' });
    } finally {
      setModelFormSaving(false);
    }
  };

  const handleDeleteModel = async (m: any) => {
    setDeleteModelConfirm(m);
  };

  const confirmDeleteModel = async () => {
    const m = deleteModelConfirm;
    if (!m) return;
    setDeleteModelConfirm(null);
    try {
      await api.delete(`/ai-roles/models/${m.id}`);
      setToast({ message: '模型已删除', type: 'success' });
      if (chatModelId === m.id) setChatModelId('');
      if (reasoningModelId === m.id) setReasoningModelId('');
      if (arbitrationModelId === m.id) setArbitrationModelId('');
      await loadModels();
    } catch (err: any) {
      setToast({ message: err.message || '删除失败', type: 'error' });
    }
  };

  const handleTestModel = async (m: any) => {
    try {
      setTestingModelId(m.id);
      setTestResult(null);
      const res: any = await api.post(`/ai-roles/models/${m.id}/test`);
      const data = res.data ?? res;
      setTestResult({ modelId: m.id, success: data.success, message: data.message, models: data.models });
    } catch (err: any) {
      setTestResult({ modelId: m.id, success: false, message: err.message || '测试失败' });
    } finally {
      setTestingModelId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500 text-sm font-body">加载中...</p></div>;
  }

  const providerLabels: Record<string, string> = {
    'openai-compatible': 'OpenAI',
    deepseek: 'DeepSeek',
    qwen: '通义千问',
    ollama: 'Ollama',
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 模型库管理 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-500 text-xs font-medium">模型库</h3>
          <button
            onClick={openAddModel}
            className="flex items-center gap-1 text-biu-primary text-xs font-body hover:text-biu-primary-dim transition"
          >
            <IconPlus size={14} /> 添加模型
          </button>
        </div>

        {models.length === 0 ? (
          <p className="text-gray-600 text-xs font-body text-center py-4">暂无模型，请点击上方添加</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {models.map((m) => (
              <GlassCard key={m.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-body truncate">{m.name}</p>
                    <p className="text-gray-500 text-[11px] font-body">
                      {providerLabels[m.provider] || m.provider} · {m.modelName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTestModel(m)}
                      disabled={testingModelId === m.id}
                      className="p-1 rounded-md hover:bg-white/10 transition text-gray-400 hover:text-biu-primary disabled:opacity-30"
                      title="测试连接"
                    >
                      <IconRefresh size={14} className={testingModelId === m.id ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => openEditModel(m)}
                      className="p-1 rounded-md hover:bg-white/10 transition text-gray-400 hover:text-biu-primary"
                      title="编辑"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteModel(m)}
                      className="p-1 rounded-md hover:bg-white/10 transition text-gray-400 hover:text-red-400"
                      title="删除"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
                {testResult && testResult.modelId === m.id && (
                  <div className={`mt-2 p-2 rounded-lg text-xs font-body ${testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {testResult.message}
                    {testResult.models && testResult.models.length > 0 && (
                      <div className="mt-1 text-gray-500">
                        可用模型: {testResult.models.slice(0, 5).join(', ')}{testResult.models.length > 5 ? '...' : ''}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* 模型编辑/添加弹窗 */}
      {showModelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModelForm(false)}>
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <GlassCard strong className="w-80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-sm font-medium font-body">{editingModel ? '编辑模型' : '添加模型'}</h3>
              <button onClick={() => setShowModelForm(false)} className="text-gray-400 hover:text-white transition"><IconX size={16} /></button>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">名称</label>
              <input
                type="text"
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                placeholder="如：DeepSeek Chat"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">服务商</label>
              <GlassSelect
                value={modelForm.provider}
                onChange={(v) => setModelForm({ ...modelForm, provider: v })}
                options={[
                  { value: 'openai-compatible', label: 'OpenAI Compatible' },
                  { value: 'deepseek', label: 'DeepSeek' },
                  { value: 'qwen', label: '通义千问' },
                  { value: 'ollama', label: 'Ollama (本地)' },
                ]}
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">接口地址 (Base URL)</label>
              <input
                type="text"
                value={modelForm.baseUrl}
                onChange={(e) => setModelForm({ ...modelForm, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">
                API Key {editingModel?.hasApiKey && <span className="text-biu-primary">(已配置)</span>}
              </label>
              <input
                type="password"
                value={modelForm.apiKey}
                onChange={(e) => setModelForm({ ...modelForm, apiKey: e.target.value })}
                placeholder={editingModel?.hasApiKey ? '••••••••（留空保持不变）' : '输入 API Key'}
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">
                模型列表
                {remoteModelsLoading && <span className="text-biu-primary ml-1">加载中...</span>}
                {!remoteModelsLoading && remoteModels.length > 0 && <span className="text-gray-600 ml-1">({remoteModels.length} 个)</span>}
              </label>
              {remoteModels.length > 0 ? (
                <GlassSelect
                  value={remoteModels.includes(modelForm.modelName) ? modelForm.modelName : '__custom__'}
                  onChange={(v) => {
                    if (v !== '__custom__') {
                      setModelForm({ ...modelForm, modelName: v });
                    }
                  }}
                  options={[
                    ...(!remoteModels.includes(modelForm.modelName) ? [{ value: '__custom__', label: modelForm.modelName || '自定义...' }] : []),
                    ...remoteModels.map((m) => ({ value: m, label: m })),
                  ]}
                />
              ) : (
                <input
                  type="text"
                  value={modelForm.modelName}
                  onChange={(e) => setModelForm({ ...modelForm, modelName: e.target.value })}
                  placeholder="填写 URL 和 Key 后自动获取，或手动输入"
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">最大回复长度</label>
                <input
                  type="number"
                  value={modelForm.maxTokens}
                  onChange={(e) => setModelForm({ ...modelForm, maxTokens: parseInt(e.target.value) || 2000 })}
                  min={100}
                  max={32000}
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm outline-none font-body"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">
                  创造性: {modelForm.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.1"
                  value={modelForm.temperature}
                  onChange={(e) => setModelForm({ ...modelForm, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-biu-primary mt-2"
                />
              </div>
            </div>
            <button
              onClick={handleModelFormSave}
              disabled={modelFormSaving}
              className="w-full py-2 rounded-xl bg-biu-primary text-biu-dark text-sm font-body font-500 hover:bg-biu-primary-dim transition disabled:opacity-30"
            >
              {modelFormSaving ? '保存中...' : (editingModel ? '更新模型' : '添加模型')}
            </button>
          </GlassCard>
          </div>
        </div>
      )}

      {/* 用途选择 */}
      <div className="pt-3 border-t border-white/5">
        <h3 className="text-gray-500 text-xs font-medium mb-3">模型用途</h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">聊天模型 <span className="text-red-400">*</span></label>
            <GlassSelect
              value={chatModelId}
              onChange={(v) => setChatModelId(v)}
              placeholder="请选择聊天模型"
              options={models.map((m) => ({ value: m.id, label: `${m.name} (${m.modelName})` }))}
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">推理模型 <span className="text-gray-600 text-[10px]">可选，空则使用聊天模型</span></label>
            <GlassSelect
              value={reasoningModelId}
              onChange={(v) => setReasoningModelId(v)}
              placeholder="使用聊天模型"
              options={models.map((m) => ({ value: m.id, label: `${m.name} (${m.modelName})` }))}
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">仲裁模型 <span className="text-gray-600 text-[10px]">可选，空则使用聊天模型</span></label>
            <GlassSelect
              value={arbitrationModelId}
              onChange={(v) => setArbitrationModelId(v)}
              placeholder="使用聊天模型"
              options={models.map((m) => ({ value: m.id, label: `${m.name} (${m.modelName})` }))}
            />
          </div>
        </div>
      </div>

      {/* 思考模型 */}
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
                <label className="text-gray-500 text-xs font-medium mb-1 block">推理强度 (reasoning_effort)</label>
                <GlassSelect
                  value={reasoningEffort}
                  onChange={(v) => setReasoningEffort(v)}
                  options={[
                    { value: 'low', label: '低 (low)' },
                    { value: 'medium', label: '中 (medium)' },
                    { value: 'high', label: '高 (high)' },
                  ]}
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1 block">思考内容展示</label>
                <GlassSelect
                  value={reasoningDisplay}
                  onChange={(v) => setReasoningDisplay(v)}
                  options={[
                    { value: 'hidden', label: '隐藏' },
                    { value: 'visible', label: '折叠显示' },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI 触发模式 */}
      <div className="pt-3 border-t border-white/5">
        <h3 className="text-gray-500 text-xs font-medium mb-3">AI 触发模式</h3>
        <div className="space-y-2">
          {[
            { value: 'always', label: '始终回复', desc: '每条消息都触发 AI 回复' },
            { value: 'mention', label: '@提及触发', desc: '仅在 @AI 时回复' },
            { value: 'smart', label: '智能触发', desc: 'AI 自行判断是否需要回复' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAiTriggerMode(opt.value as any)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 ${
                aiTriggerMode === opt.value
                  ? 'bg-biu-primary/15 border border-biu-primary/30'
                  : 'bg-white/5 border border-transparent hover:bg-white/8'
              }`}
            >
              <p className={`text-sm font-body ${aiTriggerMode === opt.value ? 'text-biu-primary' : 'text-white'}`}>
                {opt.label}
              </p>
              <p className="text-gray-600 text-[11px] font-body">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 上下文配置 */}
      <div className="pt-3 border-t border-white/5">
        <h3 className="text-gray-500 text-xs font-medium mb-3">上下文配置</h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">
              历史消息条数: {contextMessageLimit === 0 ? '无限' : contextMessageLimit}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={contextMessageLimit}
              onChange={(e) => setContextMessageLimit(parseInt(e.target.value))}
              className="w-full accent-biu-primary"
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-body mt-0.5">
              <span>无限</span>
              <span>100条</span>
            </div>
            <p className="text-gray-600 text-[11px] font-body mt-1">AI 回复时参考的最近消息数量，0 为无限，越多越有上下文感但消耗更多 token</p>
          </div>
          <div>
            <label className="text-gray-500 text-xs font-medium mb-1 block">
              仲裁模型最大输出: {arbitrationMaxTokens}
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={arbitrationMaxTokens}
              onChange={(e) => setArbitrationMaxTokens(parseInt(e.target.value))}
              className="w-full accent-biu-primary"
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-body mt-0.5">
              <span>50</span>
              <span>1000</span>
            </div>
            <p className="text-gray-600 text-[11px] font-body mt-1">仲裁模型判断是否回复时的最大输出 token 数，越大决策越详细</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-body">参考私聊记录</p>
              <p className="text-gray-600 text-[11px] font-body">AI 回复时可参考与发送者的私聊历史</p>
            </div>
            <button
              onClick={() => setIncludePrivateContext(!includePrivateContext)}
              className={`w-10 h-6 rounded-full transition-all duration-200 relative ${includePrivateContext ? 'bg-biu-primary' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${includePrivateContext ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 流式输出 */}
      <div className="pt-3 border-t border-white/5">
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

      {/* 保存 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-biu-primary text-biu-dark text-sm font-body font-500 hover:bg-biu-primary-dim transition disabled:opacity-30"
      >
        {saving ? '保存中...' : '保存配置'}
      </button>
      <GlassConfirm
        open={deleteModelConfirm !== null}
        title="删除模型"
        message={`确定删除模型「${deleteModelConfirm?.name || ''}」？此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={confirmDeleteModel}
        onCancel={() => setDeleteModelConfirm(null)}
      />
    </div>
  );
}
