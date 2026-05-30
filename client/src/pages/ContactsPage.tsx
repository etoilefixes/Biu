import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { IconSearch, IconChat } from '../components/Icons';
import { User } from '@biu/shared';

export default function ContactsPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const { loadConversations, addConversationOptimistic, replaceTempConversation } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    try {
      const res: any = await api.get(`/users/search?keyword=${keyword}`);
      setResults(res.data);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
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

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">联系人</h1>
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <IconSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索用户名或昵称..."
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white transition"
          >
            <IconSearch size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {results.map((u) => (
            <GlassCard key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-biu-secondary/30 flex items-center justify-center text-white text-sm font-bold">
                  {u.nickname[0]}
                </div>
                <div>
                  <p className="text-white font-medium">{u.nickname}</p>
                  <p className="text-gray-500 text-xs">@{u.username}</p>
                </div>
              </div>
              <button
                onClick={() => handleStartChat(u)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-biu-primary/20 text-biu-secondary hover:bg-biu-primary/40 transition text-sm"
              >
                <IconChat size={14} /> 发消息
              </button>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
