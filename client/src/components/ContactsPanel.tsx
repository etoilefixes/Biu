import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import UserBadge from '../components/UserBadge';
import AvatarWithBadge from '../components/AvatarWithBadge';
import { IconSearch, IconChat, IconCheck, IconX, IconTrash, IconAddFriend, IconFriendRequest, IconContacts } from '../components/Icons';
import { User } from '@biu/shared';

type Tab = 'friends' | 'requests';

interface ContactsPanelProps {
  onClose: () => void;
}

export default function ContactsPanel({ onClose }: ContactsPanelProps) {
  const [tab, setTab] = useState<Tab>('friends');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{ x: number; y: number } | null>(null);
  const { loadConversations, addConversationOptimistic, replaceTempConversation } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const {
    friends,
    receivedRequests,
    sentRequests,
    setFriends,
    setReceivedRequests,
    setSentRequests,
  } = useFriendStore();
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    handleLoadFriends();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewUser(null);
        setPreviewAnchor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    try {
      const res: any = await api.get(`/users/search?keyword=${keyword}`);
      setResults(res.data);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleSendFriendRequest = async (toUserId: string) => {
    try {
      await api.post('/friends/request', { toUserId });
      setToast({ message: '好友申请已发送', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '发送失败', type: 'error' });
    }
  };

  const handleLoadFriends = async () => {
    try {
      const res: any = await api.get('/friends');
      setFriends(res.data);
    } catch (err: any) {
      setToast({ message: '获取好友列表失败', type: 'error' });
    }
  };

  const handleLoadRequests = async () => {
    try {
      const res: any = await api.get('/friends/requests');
      setReceivedRequests(res.data.received);
      setSentRequests(res.data.sent);
    } catch (err: any) {
      setToast({ message: '获取好友申请失败', type: 'error' });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.put(`/friends/request/${requestId}`, { action: 'accept' });
      setToast({ message: '已添加好友', type: 'success' });
      handleLoadRequests();
      handleLoadFriends();
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '操作失败', type: 'error' });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.put(`/friends/request/${requestId}`, { action: 'reject' });
      setToast({ message: '已拒绝', type: 'success' });
      handleLoadRequests();
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '操作失败', type: 'error' });
    }
  };

  const handleDeleteFriend = async (friendId: string) => {
    if (!confirm('确定要删除这个好友吗？')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      setToast({ message: '已删除好友', type: 'success' });
      handleLoadFriends();
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '删除失败', type: 'error' });
    }
  };

  const handleStartChat = async (targetUser: User) => {
    setPreviewUser(null);
    setPreviewAnchor(null);
    const tempId = `temp_conv_${Date.now()}`;
    const tempConversation: any = {
      id: tempId,
      type: 'private',
      name: null,
      createdAt: new Date().toISOString(),
      members: [
        { userId: user?.id || '', user: { id: user?.id, nickname: user?.nickname, username: user?.username } },
        { userId: targetUser.id, user: { id: targetUser.id, nickname: targetUser.nickname, username: targetUser.username } },
      ],
      _status: 'creating',
    };
    addConversationOptimistic(tempConversation);
    onClose();
    try {
      const res: any = await api.post('/conversations', {
        type: 'private',
        memberIds: [targetUser.id],
      });
      replaceTempConversation(tempId, res.data);
      await loadConversations();
    } catch (err: any) {
      setToast({ message: '创建会话失败', type: 'error' });
    }
  };

  const handleAvatarClick = (u: User, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPreviewUser(u);
    setPreviewAnchor({ x: rect.left, y: rect.bottom + 8 });
  };

  const isFriend = (userId: string) => friends.some((f) => f.id === userId);

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 侧面板 */}
      <div className="fixed left-[60px] top-0 bottom-0 w-[360px] z-50 glass-strong flex flex-col animate-slide-in-left shadow-2xl shadow-glow">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              <button
                onClick={() => { setTab('friends'); handleLoadFriends(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                  tab === 'friends' ? 'bg-biu-primary/15 text-biu-primary' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="好友"
              >
                <IconContacts size={16} />
              </button>
              <button
                onClick={() => { setTab('requests'); handleLoadRequests(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 relative ${
                  tab === 'requests' ? 'bg-biu-primary/15 text-biu-primary' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="好友申请"
              >
                <IconFriendRequest size={16} />
                {receivedRequests.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-biu-accent text-white text-[9px] font-display font-600 flex items-center justify-center leading-none">
                    {receivedRequests.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                showSearch ? 'bg-biu-primary/15 text-biu-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
              title="搜索用户"
            >
              <IconSearch size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {previewUser && previewAnchor && (
            <div
              ref={previewRef}
              className="fixed z-50 animate-scale-in"
              style={{ left: previewAnchor.x, top: previewAnchor.y }}
            >
              <GlassCard className="w-64 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <AvatarWithBadge
                    fallback={previewUser.nickname[0]}
                    badges={previewUser.badges}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-display font-600 truncate">{previewUser.nickname}</p>
                    <p className="text-biu-primary/60 text-xs font-display">{previewUser.biuId}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isFriend(previewUser.id) ? (
                    <button
                      onClick={() => handleStartChat(previewUser)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm font-body"
                    >
                      <IconChat size={14} /> 发消息
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendFriendRequest(previewUser.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm font-body"
                    >
                      <IconAddFriend size={14} /> 添加好友
                    </button>
                  )}
                  <button
                    onClick={() => { setPreviewUser(null); setPreviewAnchor(null); }}
                    className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </GlassCard>
            </div>
          )}

          {showSearch && (
            <div className="mb-5">
              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <IconSearch size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索用户名、昵称或 Biu号..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body text-sm"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 hover:shadow-glow"
                >
                  <IconSearch size={16} />
                </button>
              </div>
              {results.length > 0 && (
                <div className="space-y-2 mb-4">
                  {results.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleAvatarClick(u, e)}
                          className="shrink-0"
                        >
                          <AvatarWithBadge
                            fallback={u.nickname[0]}
                            badges={u.badges}
                            size="md"
                          />
                        </button>
                        <span className="text-white font-medium font-display text-sm">{u.nickname}</span>
                      </div>
                      <div className="flex gap-2">
                        {!isFriend(u.id) && (
                          <button
                            onClick={() => handleSendFriendRequest(u.id)}
                            className="p-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition"
                            title="添加好友"
                          >
                            <IconAddFriend size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleStartChat(u)}
                          className="p-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition"
                          title="发消息"
                        >
                          <IconChat size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-b border-white/5" />
            </div>
          )}

          {tab === 'friends' && (
            <div className="space-y-1">
              {friends.length === 0 && (
                <p className="text-gray-600 text-sm font-body text-center py-8">暂无好友，点击搜索图标添加</p>
              )}
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleAvatarClick(f, e)}
                      className="shrink-0"
                    >
                      <AvatarWithBadge
                        fallback={f.isSystem ? '🔔' : f.nickname[0]}
                        isSystem={f.isSystem}
                        badges={f.badges}
                        size="md"
                      />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium font-display text-sm">{f.nickname}</span>
                      <UserBadge badges={f.badges} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartChat(f)}
                      className="p-2 rounded-lg text-biu-primary hover:bg-biu-primary/10 transition"
                      title="发消息"
                    >
                      <IconChat size={16} />
                    </button>
                    {!f.isSystem && (
                      <button
                        onClick={() => handleDeleteFriend(f.id)}
                        className="p-2 rounded-lg text-biu-accent hover:bg-biu-accent/10 transition"
                        title="删除好友"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-4">
              {receivedRequests.filter((r) => r.status === 'pending').length > 0 && (
                <div>
                  <h3 className="text-gray-400 text-xs font-display mb-3 uppercase tracking-wider">收到的好友申请</h3>
                  <div className="space-y-2">
                    {receivedRequests.filter((r) => r.status === 'pending').map((r) => (
                      <GlassCard key={r.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => r.fromUser && handleAvatarClick(r.fromUser as any, e)}
                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-accent/30 to-biu-accent/10 flex items-center justify-center text-white text-sm font-display font-600 shrink-0"
                          >
                            {r.fromUser?.nickname?.[0] || '?'}
                          </button>
                          <div>
                            <p className="text-white font-medium font-display text-sm">{r.fromUser?.nickname}</p>
                            <p className="text-gray-500 text-xs font-body">{r.message || '请求添加你为好友'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(r.id)}
                            className="p-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition"
                          >
                            <IconCheck size={16} />
                          </button>
                          <button
                            onClick={() => handleRejectRequest(r.id)}
                            className="p-2 rounded-lg bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition"
                          >
                            <IconX size={16} />
                          </button>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )}
              {sentRequests.filter((r) => r.status === 'pending').length > 0 && (
                <div>
                  <h3 className="text-gray-400 text-xs font-display mb-3 uppercase tracking-wider">发出的好友申请</h3>
                  <div className="space-y-2">
                    {sentRequests.filter((r) => r.status === 'pending').map((r) => (
                      <GlassCard key={r.id} className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-primary/25 to-biu-primary/8 flex items-center justify-center text-white text-sm font-display font-600 shrink-0">
                          {r.toUser?.nickname?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium font-display text-sm">{r.toUser?.nickname}</p>
                          <p className="text-gray-600 text-xs font-body">等待对方确认</p>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )}
              {receivedRequests.filter((r) => r.status === 'pending').length === 0 && sentRequests.filter((r) => r.status === 'pending').length === 0 && (
                <p className="text-gray-600 text-sm font-body text-center py-8">暂无好友申请</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
