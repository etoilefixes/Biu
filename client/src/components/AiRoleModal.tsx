import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';
import Toast from './Toast';
import GlassCard from './GlassCard';
import AvatarWithBadge from './AvatarWithBadge';
import { IconX, IconPlus, IconEdit, IconTrash, IconRobot, IconSearch } from './Icons';

interface AiRole {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  systemPrompt: string | null;
  speakingStyle: string | null;
  forbiddenTopics: string | null;
  greeting: string | null;
  model: string | null;
  useReasoning: boolean;
  replyLength: string;
  temperature: number;
  maxTokens: number;
  visibility: string;
  userId: string;
  creator: { id: string; nickname: string; avatar: string | null };
  createdAt: string;
  updatedAt: string;
}

interface AiRoleModalProps {
  onClose: () => void;
}

export default function AiRoleModal({ onClose }: AiRoleModalProps) {
  const [roles, setRoles] = useState<AiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingRole, setEditingRole] = useState<AiRole | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const addConversationOptimistic = useChatStore((s) => s.addConversationOptimistic);
  const replaceTempConversation = useChatStore((s) => s.replaceTempConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const loadConversations = useChatStore((s) => s.loadConversations);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/ai-roles');
      setRoles(res.data);
    } catch (err: any) {
      setToast({ message: err.message || '获取角色列表失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChatWithRole = async (role: AiRole) => {
    try {
      const res: any = await api.post(`/ai-roles/${role.id}/chat`);
      const { conversation, isNew } = res.data;

      if (isNew) {
        // 刷新会话列表并选中新会话
        await loadConversations();
        const convs = useChatStore.getState().conversations;
        const newConv = convs.find((c: any) => c.id === conversation.id);
        if (newConv) {
          selectConversation(newConv);
        }
      } else {
        // 已有会话，直接选中
        await loadConversations();
        const convs = useChatStore.getState().conversations;
        const existingConv = convs.find((c: any) => c.id === conversation.id);
        if (existingConv) {
          selectConversation(existingConv);
        }
      }

      onClose();
    } catch (err: any) {
      setToast({ message: err.message || '创建会话失败', type: 'error' });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await api.delete(`/ai-roles/${roleId}`);
      setRoles(roles.filter((r) => r.id !== roleId));
      setToast({ message: '角色已删除', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || '删除失败', type: 'error' });
    }
  };

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const user = useChatStore((s) => s.currentConversation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[680px] max-h-[85vh] glass-strong rounded-2xl shadow-2xl flex flex-col animate-scale-in">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-biu-primary/15 flex items-center justify-center">
              <IconRobot size={18} className="text-biu-primary" />
            </div>
            <div>
              <h2 className="text-white font-display font-600 text-sm">AI 角色库</h2>
              <p className="text-gray-500 text-xs font-body">选择一个角色开始聊天</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingRole(null); setShowEditor(true); }}
              className="px-3 py-1.5 rounded-lg bg-biu-primary/15 text-biu-primary text-xs font-display font-500 hover:bg-biu-primary/25 transition flex items-center gap-1.5"
            >
              <IconPlus size={14} /> 创建角色
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition">
              <IconX size={18} />
            </button>
          </div>
        </div>

        {showEditor ? (
          <AiRoleEditor
            role={editingRole}
            onSave={async () => {
              setShowEditor(false);
              setEditingRole(null);
              await fetchRoles();
            }}
            onCancel={() => { setShowEditor(false); setEditingRole(null); }}
          />
        ) : (
          <>
            {/* Search */}
            <div className="px-6 py-3 border-b border-white/5">
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索角色..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
                />
              </div>
            </div>

            {/* Role List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm font-body">加载中...</p>
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-biu-primary/8 border border-biu-primary/15 flex items-center justify-center mb-4">
                    <IconRobot size={28} className="text-biu-primary/50" />
                  </div>
                  <p className="text-gray-400 text-sm font-display font-500 mb-1">暂无角色</p>
                  <p className="text-gray-600 text-xs font-body">点击"创建角色"添加你的第一个 AI 角色</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredRoles.map((role) => (
                    <div
                      key={role.id}
                      className="glass rounded-xl p-4 hover:bg-white/5 transition cursor-pointer group"
                      onClick={() => handleChatWithRole(role)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-biu-primary/10 flex items-center justify-center shrink-0">
                          {role.avatar ? (
                            <img src={role.avatar} alt={role.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-biu-primary text-lg font-display font-600">
                              {role.name[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-white text-sm font-display font-600 truncate">{role.name}</h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingRole(role); setShowEditor(true); }}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-biu-primary hover:bg-white/5 transition"
                              >
                                <IconEdit size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-biu-accent hover:bg-white/5 transition"
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          </div>
                          {role.description && (
                            <p className="text-gray-500 text-xs font-body mt-0.5 line-clamp-2">{role.description}</p>
                          )}
                          {role.greeting && (
                            <p className="text-gray-600 text-[11px] font-body mt-1.5 italic line-clamp-1">"{role.greeting}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 角色编辑器
function AiRoleEditor({
  role,
  onSave,
  onCancel,
}: {
  role: AiRole | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name || '');
  const [avatar, setAvatar] = useState(role?.avatar || '');
  const [description, setDescription] = useState(role?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(role?.systemPrompt || '');
  const [speakingStyle, setSpeakingStyle] = useState(role?.speakingStyle || '');
  const [forbiddenTopics, setForbiddenTopics] = useState(role?.forbiddenTopics || '');
  const [greeting, setGreeting] = useState(role?.greeting || '');
  const [model, setModel] = useState(role?.model || '');
  const [useReasoning, setUseReasoning] = useState(role?.useReasoning ?? false);
  const [replyLength, setReplyLength] = useState(role?.replyLength || 'medium');
  const [temperature, setTemperature] = useState(role?.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(role?.maxTokens || 2000);
  const [visibility, setVisibility] = useState(role?.visibility || 'public');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ message: '角色名称不能为空', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: name.trim(),
        avatar: avatar.trim() || null,
        description: description.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        speakingStyle: speakingStyle.trim() || null,
        forbiddenTopics: forbiddenTopics.trim() || null,
        greeting: greeting.trim() || null,
        model: model.trim() || null,
        useReasoning,
        replyLength,
        temperature,
        maxTokens,
        visibility,
      };

      if (role) {
        await api.put(`/ai-roles/${role.id}`, data);
      } else {
        await api.post('/ai-roles', data);
      }

      onSave();
    } catch (err: any) {
      setToast({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-5">
        {/* 基本信息 */}
        <div>
          <h3 className="text-white text-sm font-display font-600 mb-3">基本信息</h3>
          <div className="space-y-3">
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">角色名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="给角色起个名字"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">头像 URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="输入头像图片 URL"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">角色描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述这个角色"
                rows={2}
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body resize-none"
              />
            </div>
          </div>
        </div>

        {/* 角色设定 */}
        <div>
          <h3 className="text-white text-sm font-display font-600 mb-3">角色设定</h3>
          <div className="space-y-3">
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">人设 Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="描述角色的核心人设，这是发送给 AI 的系统提示词。如：你是一位来自古代的智者，博学多才，说话富有哲理..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body resize-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">说话风格</label>
              <textarea
                value={speakingStyle}
                onChange={(e) => setSpeakingStyle(e.target.value)}
                placeholder="描述角色的说话方式，如：喜欢用古风语言、说话简洁有力..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body resize-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">禁止事项</label>
              <textarea
                value={forbiddenTopics}
                onChange={(e) => setForbiddenTopics(e.target.value)}
                placeholder="角色不会讨论的话题或行为限制"
                rows={2}
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body resize-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">开场白</label>
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="角色第一次聊天时说的话"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
            </div>
          </div>
        </div>

        {/* 参数设置 */}
        <div>
          <h3 className="text-white text-sm font-display font-600 mb-3">参数设置</h3>
          <div className="space-y-3">
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">使用模型</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="留空使用全局默认模型"
                className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
              />
              <p className="text-gray-600 text-[11px] font-body mt-0.5">留空则使用全局 AI 设置中的默认模型</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-body">启用思考模型</p>
                <p className="text-gray-600 text-[11px] font-body">使用推理模型（如 deepseek-reasoner）</p>
              </div>
              <button
                onClick={() => setUseReasoning(!useReasoning)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${useReasoning ? 'bg-biu-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${useReasoning ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">回复长度</label>
              <div className="flex gap-2">
                {[
                  { value: 'short', label: '简短' },
                  { value: 'medium', label: '适中' },
                  { value: 'long', label: '详细' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReplyLength(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body transition ${
                      replyLength === opt.value
                        ? 'bg-biu-primary/20 text-biu-primary'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
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
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1 block">可见性</label>
              <div className="flex gap-2">
                {[
                  { value: 'public', label: '公开' },
                  { value: 'private', label: '私有' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setVisibility(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body transition ${
                      visibility === opt.value
                        ? 'bg-biu-primary/20 text-biu-primary'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-gray-600 text-[11px] font-body mt-0.5">公开角色所有用户可见，私有仅自己可见</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-body hover:bg-white/10 transition"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 rounded-lg bg-biu-primary text-biu-dark text-sm font-body font-500 hover:bg-biu-primary-dim transition disabled:opacity-30"
        >
          {saving ? '保存中...' : role ? '更新角色' : '创建角色'}
        </button>
      </div>
    </div>
  );
}
