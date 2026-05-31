import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import api from '../services/api';
import { socketService } from '../services/socket';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { IconSearch, IconChat, IconUserPlus, IconCheck, IconX, IconTrash } from '../components/Icons';
import { User, FriendRequest } from '@biu/shared';

type Tab = 'search' | 'friends' | 'requests';

export default function ContactsPage() {
  const [tab, setTab] = useState<Tab>('search');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const { loadConversations, addConversationOptimistic, replaceTempConversation } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const { 
    friends, 
    receivedRequests, 
    sentRequests,
    setFriends, 
    setReceivedRequests, 
    setSentRequests, 
    addReceivedRequest 
  } = useFriendStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleFriendRequest = (request: FriendRequest) => {
      addReceivedRequest(request);
      setToast({ message: '收到新的好友请求', type: 'success' });
    };

    socketService.onFriendRequest(handleFriendRequest);

    return () => {
      socketService.offFriendRequest();
    };
  }, [addReceivedRequest]);

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
      setToast({ message: '好友请求已发送', type: 'success' });
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
      setToast({ message: '获取请求失败', type: 'error' });
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
    navigate('/chat');

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

  const tabs: { key: Tab; label: string; onClick?: () => void }[] = [
    { key: 'search', label: '搜索' },
    { key: 'friends', label: '好友', onClick: handleLoadFriends },
    { key: 'requests', label: '请求', onClick: handleLoadRequests },
  ];

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-display font-700 text-white mb-6">联系人</h1>

        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); t.onClick?.(); }}
              className={`px-4 py-2 rounded-lg text-sm font-body transition-all duration-200 ${
                tab === t.key
                  ? 'bg-biu-primary/20 text-biu-primary'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'search' && (
          <>
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <IconSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索用户名、昵称或 Biu号..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 hover:shadow-glow"
              >
                <IconSearch size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {results.map((u) => (
                <GlassCard key={u.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10 flex items-center justify-center text-white text-sm font-display font-600">
                      {u.nickname[0]}
                    </div>
                    <div>
                      <p className="text-white font-medium font-display">{u.nickname}</p>
                      <p className="text-biu-primary/60 text-xs font-display">{u.biuId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendFriendRequest(u.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm font-body"
                    >
                      <IconUserPlus size={14} /> 加好友
                    </button>
                    <button
                      onClick={() => handleStartChat(u)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-biu-secondary/10 text-biu-secondary hover:bg-biu-secondary/20 transition text-sm font-body"
                    >
                      <IconChat size={14} /> 发消息
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}

        {tab === 'friends' && (
          <div className="space-y-3">
            {friends.length === 0 && (
              <p className="text-gray-600 text-sm font-body text-center py-8">暂无好友，去搜索添加吧</p>
            )}
            {friends.map((f) => (
              <GlassCard key={f.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-primary/30 to-biu-primary/10 flex items-center justify-center text-white text-sm font-display font-600">
                    {f.nickname[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium font-display">{f.nickname}</p>
                    <p className="text-biu-primary/60 text-xs font-display">{f.biuId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartChat(f)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm font-body"
                  >
                    <IconChat size={14} /> 发消息
                  </button>
                  <button
                    onClick={() => handleDeleteFriend(f.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20 transition text-sm font-body"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-4">
            {receivedRequests.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-display mb-3 uppercase tracking-wider">收到的请求</h3>
                <div className="space-y-3">
                  {receivedRequests.map((r) => (
                    <GlassCard key={r.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-accent/30 to-biu-accent/10 flex items-center justify-center text-white text-sm font-display font-600">
                          {r.fromUser?.nickname?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium font-display">{r.fromUser?.nickname}</p>
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
            {sentRequests.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-display mb-3 uppercase tracking-wider">发出的请求</h3>
                <div className="space-y-3">
                  {sentRequests.map((r) => (
                    <GlassCard key={r.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10 flex items-center justify-center text-white text-sm font-display font-600">
                          {r.toUser?.nickname?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium font-display">{r.toUser?.nickname}</p>
                          <p className="text-gray-600 text-xs font-body">等待对方确认</p>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}
            {receivedRequests.length === 0 && sentRequests.length === 0 && (
              <p className="text-gray-600 text-sm font-body text-center py-8">暂无好友请求</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
