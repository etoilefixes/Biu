import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useFriendStore } from '../store/friendStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';
import Toast from '../components/Toast';
import GlassCard from '../components/GlassCard';
import { IconSearch, IconSend, IconChat, IconX, IconCheck, IconAddFriend, IconGroup } from '../components/Icons';

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const {
    conversations,
    currentConversation,
    messages,
    unreadMap,
    totalUnread,
    loadConversations,
    selectConversation,
    sendMessage,
    addMessage,
    removeMessage,
    setUnread,
    setTyping,
    addConversationOptimistic,
    replaceTempConversation,
    markAllRead,
    deleteConversation,
  } = useChatStore();
  const { friends, setFriends } = useFriendStore();
  const [input, setInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isDragging = useRef(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [addFriendKeyword, setAddFriendKeyword] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [openedConvId, setOpenedConvId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    api.get('/friends').then((res: any) => setFriends(res.data)).catch(() => {});
    socketService.onMessage(addMessage);
    socketService.onTyping((data) => setTyping(data.conversationId, data.userId));
    socketService.onUnread((data) => {
      const currentId = useChatStore.getState().currentConversation?.id;
      if (currentId !== data.conversationId) {
        setUnread(data.conversationId, data.count);
      }
    });
    return () => {
      socketService.offMessage();
      socketService.offTyping();
      socketService.offUnread();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.max(200, Math.min(400, e.clientX - 60));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim(), 'text', user?.id);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = () => setToast({ message: '已复制到剪贴板', type: 'success' });

  const handleDeleteMessage = (id: string) => {
    removeMessage(id);
    setToast({ message: '消息已删除', type: 'success' });
  };

  const handleRetryMessage = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      removeMessage(id);
      sendMessage(msg.content, msg.type, user?.id);
    }
  };

  const convDisplayName = (conv: typeof currentConversation) => {
    if (!conv) return '';
    if (conv.type === 'group') return conv.name;
    return conv.members.find((m) => m.userId !== user?.id)?.user?.nickname || '未知用户';
  };

  const handleOpenGroupModal = async () => {
    setShowAddDropdown(false);
    setShowGroupModal(true);
    setGroupName('');
    setSelectedMemberIds([]);
    try {
      const res: any = await api.get('/friends');
      setFriends(res.data);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const handleOpenAddFriendModal = () => {
    setShowAddDropdown(false);
    setShowAddFriendModal(true);
    setAddFriendKeyword('');
    setAddFriendResults([]);
  };

  const handleSearchFriend = async () => {
    if (!addFriendKeyword.trim()) return;
    try {
      const res: any = await api.get(`/users/search?keyword=${addFriendKeyword}`);
      setAddFriendResults(res.data);
    } catch (err: any) {
      setToast({ message: '搜索失败', type: 'error' });
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

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setToast({ message: '请输入群名称', type: 'error' });
      return;
    }
    if (selectedMemberIds.length === 0) {
      setToast({ message: '请至少选择一位成员', type: 'error' });
      return;
    }
    const tempId = `temp_conv_${Date.now()}`;
    const tempConversation: any = {
      id: tempId,
      type: 'group',
      name: groupName.trim(),
      createdAt: new Date().toISOString(),
      members: [
        { userId: user?.id || '', user: { id: user?.id, nickname: user?.nickname, username: user?.username } },
        ...selectedMemberIds.map((id) => {
          const friend = friends.find((f) => f.id === id);
          return { userId: id, user: { id, nickname: friend?.nickname, username: friend?.username } };
        }),
      ],
      _status: 'creating',
    };
    addConversationOptimistic(tempConversation);
    setShowGroupModal(false);
    try {
      const res: any = await api.post('/conversations', {
        type: 'group',
        name: groupName.trim(),
        memberIds: selectedMemberIds,
      });
      replaceTempConversation(tempId, res.data);
      await loadConversations();
      setToast({ message: '群聊创建成功', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '创建群聊失败', type: 'error' });
    }
  };

  const isFriend = (userId: string) => friends.some((f) => f.id === userId);

  const otherUser = currentConversation?.type === 'private'
    ? currentConversation.members.find((m) => m.userId !== user?.id)
    : null;

  const filteredConversations = searchQuery
    ? conversations.filter((conv) => {
        const name = conv.type === 'group'
          ? conv.name || ''
          : conv.members.find((m) => m.userId !== user?.id)?.user?.nickname || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showAddFriendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[400px] max-h-[70vh] flex flex-col p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-display font-700 text-lg">添加好友</h2>
              <button onClick={() => setShowAddFriendModal(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <IconSearch size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={addFriendKeyword}
                  onChange={(e) => setAddFriendKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchFriend()}
                  placeholder="搜索用户名、昵称或 Biu号..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearchFriend}
                className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 hover:shadow-glow"
              >
                <IconSearch size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {addFriendResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10 flex items-center justify-center text-white text-sm font-display font-600">
                      {u.nickname[0]}
                    </div>
                    <span className="text-white font-display text-sm">{u.nickname}</span>
                  </div>
                  {isFriend(u.id) ? (
                    <span className="text-gray-500 text-xs font-body">已是好友</span>
                  ) : (
                    <button
                      onClick={() => handleSendFriendRequest(u.id)}
                      className="p-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition"
                      title="添加好友"
                    >
                      <IconAddFriend size={16} />
                    </button>
                  )}
                </div>
              ))}
              {addFriendResults.length === 0 && addFriendKeyword && (
                <p className="text-gray-600 text-sm text-center py-4">未找到用户</p>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[420px] max-h-[80vh] flex flex-col p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-display font-700 text-lg">创建群聊</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">群名称</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="输入群聊名称..."
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
              />
            </div>
            <div className="mb-4">
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">
                选择成员 ({selectedMemberIds.length} 人已选)
              </label>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {friends.length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-4">暂无好友可添加</p>
                )}
                {friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => toggleMember(f.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                      selectedMemberIds.includes(f.id)
                        ? 'bg-biu-primary/15 ring-1 ring-biu-primary/40'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-biu-primary/30 to-biu-primary/10 flex items-center justify-center text-white text-xs font-display font-600">
                      {f.nickname[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white text-sm font-display">{f.nickname}</p>
                    </div>
                    {selectedMemberIds.includes(f.id) && (
                      <IconCheck size={16} className="text-biu-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMemberIds.length === 0}
              className="w-full py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-600 transition-all duration-200 disabled:opacity-30 hover:shadow-glow"
            >
              创建群聊
            </button>
          </GlassCard>
        </div>
      )}

      <div
        className="glass border-r border-white/5 flex flex-col shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="p-3 relative flex gap-2 items-center">
          <div className="flex-1 relative">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="w-full pl-8 pr-3 py-2.5 rounded-xl glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
            />
          </div>
          {totalUnread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-biu-primary hover:text-biu-primary-dim transition whitespace-nowrap font-body"
            >
              全部已读
            </button>
          )}
          <div className="relative" ref={addDropdownRef}>
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="w-10 h-10 rounded-xl bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 flex items-center justify-center transition shrink-0"
              title="添加"
            >
              <IconAddFriend size={18} />
            </button>
            {showAddDropdown && (
              <div className="absolute right-0 top-12 z-40 animate-scale-in">
                <GlassCard className="w-40 py-1.5">
                  <button
                    onClick={handleOpenAddFriendModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition font-body"
                  >
                    <IconAddFriend size={16} className="text-biu-primary" /> 添加好友
                  </button>
                  <button
                    onClick={handleOpenGroupModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition font-body"
                  >
                    <IconGroup size={16} className="text-biu-primary" /> 发起群聊
                  </button>
                </GlassCard>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {filteredConversations.map((conv) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ layout: { type: 'spring', stiffness: 350, damping: 35 }, opacity: { duration: 0.2 }, height: { duration: 0.2 } }}
                className="!overflow-hidden"
              >
                <ConversationItem
                  conversation={conv}
                  active={currentConversation?.id === conv.id}
                  onClick={() => selectConversation(conv)}
                  currentUserId={user?.id || ''}
                  unreadCount={unreadMap[conv.id] || 0}
                  onDelete={deleteConversation}
                  isOpened={openedConvId === conv.id}
                  onSwipeOpen={setOpenedConvId}
                  onSwipeClose={() => setOpenedConvId(null)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div
        className="w-0.5 shrink-0 resize-handle hover:bg-biu-primary/30 active:bg-biu-primary/50"
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
              <h2 className="text-white font-display font-600 text-sm tracking-wide">{convDisplayName(currentConversation)}</h2>
              {currentConversation.type === 'group' && (
                <span className="ml-2 text-gray-500 text-xs font-body">
                  ({currentConversation.members.length}人)
                </span>
              )}
              {currentConversation.type === 'private' && otherUser && !isFriend(otherUser.userId) && (
                <button
                  onClick={() => handleSendFriendRequest(otherUser.userId)}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-xs font-body"
                >
                  <IconAddFriend size={12} /> 添加到通讯录
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isSelf={msg.senderId === user?.id}
                  onCopy={handleCopy}
                  onDelete={handleDeleteMessage}
                  onRetry={handleRetryMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 glass-strong border-t border-white/5">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 disabled:opacity-30 hover:shadow-glow"
                >
                  <IconSend size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-biu-primary/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <IconChat size={28} className="text-biu-primary" />
              </div>
              <p className="text-gray-500 text-sm font-body">选择一个会话开始聊天</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
