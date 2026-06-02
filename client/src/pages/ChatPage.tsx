import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useFriendStore } from '../store/friendStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';
import EmojiPicker from '../components/EmojiPicker';
import Toast from '../components/Toast';
import GlassCard from '../components/GlassCard';
import UserBadge from '../components/UserBadge';
import AvatarWithBadge from '../components/AvatarWithBadge';
import { IconSearch, IconSend, IconChat, IconX, IconCheck, IconAddFriend, IconGroup, IconEmoji, IconPlus, IconMore, IconUsers, IconSettings, IconEdit, IconTrash, IconAnnouncement } from '../components/Icons';

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
    markMessageFailed,
    setUnread,
    setTyping,
    addConversationOptimistic,
    replaceTempConversation,
    markAllRead,
    deleteConversation,
  } = useChatStore();
  const { friends, setFriends } = useFriendStore();
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isDragging = useRef(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addFriendKeyword, setAddFriendKeyword] = useState('');
  const [addMemberKeyword, setAddMemberKeyword] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<any[]>([]);
  const [addMemberResults, setAddMemberResults] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [openedConvId, setOpenedConvId] = useState<string | null>(null);
  
  // @ 功能
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [groupSettingsMode, setGroupSettingsMode] = useState<'info' | 'announcement' | 'members'>('info');
  const [announcementText, setAnnouncementText] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editMyNickname, setEditMyNickname] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ type: 'leave' | 'dissolve' | 'remove'; memberId?: string; title: string; message: string } | null>(null);
  const groupSettingsRef = useRef<HTMLDivElement>(null);

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
    socketService.onChatError((data) => {
      const { messages } = useChatStore.getState();
      const sendingMsgs = messages.filter(
        (m) =>
          (m as any)._status === 'sending' &&
          m.conversationId === data.conversationId
      );
      if (sendingMsgs.length === 1) {
        markMessageFailed(sendingMsgs[0].id);
      } else if (sendingMsgs.length > 1) {
        const latest = sendingMsgs[sendingMsgs.length - 1];
        markMessageFailed(latest.id);
      }
      setToast({ message: data.message || '消息发送失败', type: 'error' });
    });
    socketService.onChatAck((_data) => {
    });
    useChatStore.getState().cleanupStaleSending();
    return () => {
      socketService.offMessage();
      socketService.offTyping();
      socketService.offUnread();
      socketService.offChatError();
      socketService.offChatAck();
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
    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      handleSend();
    }
    
    // 处理 @ 下拉菜单
    if (showMentionDropdown) {
      if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        setMentionSearch('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
      }
    }
  };
  
  // 处理输入框变化，检测 @ 触发
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInput = e.target.value;
    setInput(newInput);
    
    // 检测 @ 符号
    const lastAt = newInput.lastIndexOf('@');
    if (lastAt !== -1) {
      const textAfter = newInput.slice(lastAt + 1);
      // 检查 @ 后面是空格或者行首
      const beforeAt = lastAt === 0 || newInput[lastAt - 1] === ' ';
      if (beforeAt && !textAfter.includes(' ')) {
        setShowMentionDropdown(true);
        setMentionSearch(textAfter);
      } else {
        setShowMentionDropdown(false);
        setMentionSearch('');
      }
    } else {
      setShowMentionDropdown(false);
      setMentionSearch('');
    }
  };
  
  // 选择要 @ 的用户
  const handleSelectMention = (userId: string, displayName: string) => {
    const lastAt = input.lastIndexOf('@');
    if (lastAt === -1) return;
    
    const mentionTag = userId === 'all' ? '[at:all]' : `[at:${userId}]`;
    const newInput = input.slice(0, lastAt) + mentionTag + ' ' + input.slice(lastAt + mentionSearch.length + 1);
    
    setInput(newInput);
    setShowMentionDropdown(false);
    setMentionSearch('');
    
    // 聚焦回输入框
    setTimeout(() => inputRef.current?.focus(), 0);
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
    const other = conv.members.find((m) => m.userId !== user?.id);
    if (other?.user?.isSystem) return 'Biu 系统';
    return other?.user?.nickname || '未知用户';
  };

  const isSystemConversation = currentConversation?.type === 'private' &&
    !!currentConversation.members.find((m) => m.userId !== user?.id)?.user?.isSystem;

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

  const handleSearchMember = async (keyword: string) => {
    setAddMemberKeyword(keyword);
    if (keyword.trim()) {
      api.get(`/users/search?keyword=${encodeURIComponent(keyword)}`).then((res: any) => {
        setAddMemberResults(res.data);
      }).catch(() => {});
    } else {
      setAddMemberResults([]);
    }
  };

  const handleAddMember = async (memberUserId: string) => {
    if (!currentConversation) return;
    api.post(`/conversations/${currentConversation.id}/members`, { memberUserId }).then(() => {
      setToast({ message: '成员添加成功', type: 'success' });
      loadConversations();
      setShowAddMemberModal(false);
    }).catch((err: any) => {
      setToast({ message: err.response?.data?.message || '添加失败', type: 'error' });
    });
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleOpenGroupSettings = () => {
    setShowGroupSettings(true);
    setGroupSettingsMode('info');
    if (currentConversation) {
      setEditGroupName(currentConversation.name || '');
      const myMember = currentConversation.members.find((m: any) => m.userId === user?.id);
      setEditMyNickname(myMember?.nickname || '');
      setAnnouncementText(currentConversation.announcement || '');
    }
  };

  const handleUpdateGroupName = async () => {
    if (!currentConversation || !editGroupName.trim()) return;
    try {
      const res: any = await api.put(`/conversations/${currentConversation.id}/name`, { name: editGroupName });
      setToast({ message: '群名称修改成功', type: 'success' });
      await loadConversations();
      setShowGroupSettings(false);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '修改失败', type: 'error' });
    }
  };

  const handleUpdateMyNickname = async () => {
    if (!currentConversation) return;
    try {
      await api.put(`/conversations/${currentConversation.id}/nickname`, { nickname: editMyNickname });
      setToast({ message: '群昵称修改成功', type: 'success' });
      await loadConversations();
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '修改失败', type: 'error' });
    }
  };

  const handleSetAnnouncement = async () => {
    if (!currentConversation) return;
    try {
      await api.put(`/conversations/${currentConversation.id}/announcement`, { announcement: announcementText });
      setToast({ message: '群公告设置成功', type: 'success' });
      await loadConversations();
      setShowGroupSettings(false);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '设置失败', type: 'error' });
    }
  };

  const handleRemoveMember = (memberId: string, nickname: string) => {
    setShowConfirmDialog({
      type: 'remove',
      memberId,
      title: '移除成员',
      message: `确定要移除「${nickname}」吗？`,
    });
  };

  const handleConfirmRemoveMember = async () => {
    if (!currentConversation || !showConfirmDialog?.memberId) return;
    try {
      await api.delete(`/conversations/${currentConversation.id}/members`, {
        data: { memberId: showConfirmDialog.memberId }
      });
      setToast({ message: '移除成功', type: 'success' });
      await loadConversations();
      setShowConfirmDialog(null);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '移除失败', type: 'error' });
    }
  };

  const handleLeaveGroup = () => {
    setShowConfirmDialog({
      type: 'leave',
      title: '退出群聊',
      message: '确定要退出群聊吗？',
    });
  };

  const handleConfirmLeaveGroup = async () => {
    if (!currentConversation) return;
    try {
      await api.post(`/conversations/${currentConversation.id}/leave`);
      setToast({ message: '已退出群聊', type: 'success' });
      await loadConversations();
      selectConversation(null);
      setShowConfirmDialog(null);
      setShowGroupSettings(false);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '退出失败', type: 'error' });
    }
  };

  const handleDissolveGroup = () => {
    setShowConfirmDialog({
      type: 'dissolve',
      title: '解散群聊',
      message: '确定要解散群聊吗？此操作不可恢复！',
    });
  };

  const handleConfirmDissolveGroup = async () => {
    if (!currentConversation) return;
    try {
      await api.delete(`/conversations/${currentConversation.id}/dissolve`);
      setToast({ message: '群聊已解散', type: 'success' });
      await loadConversations();
      selectConversation(null);
      setShowConfirmDialog(null);
      setShowGroupSettings(false);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '解散失败', type: 'error' });
    }
  };

  const handleConfirmAction = () => {
    if (!showConfirmDialog) return;
    switch (showConfirmDialog.type) {
      case 'leave':
        handleConfirmLeaveGroup();
        break;
      case 'dissolve':
        handleConfirmDissolveGroup();
        break;
      case 'remove':
        handleConfirmRemoveMember();
        break;
    }
  };

  const isGroupOwner = currentConversation?.ownerId === user?.id;

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
                    <AvatarWithBadge
                      fallback={u.nickname[0]}
                      badges={u.badges}
                      size="sm"
                    />
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

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[420px] max-h-[70vh] flex flex-col p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-display font-700 text-lg">添加成员</h2>
              <button onClick={() => setShowAddMemberModal(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <IconSearch size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={addMemberKeyword}
                  onChange={(e) => handleSearchMember(e.target.value)}
                  placeholder="搜索用户名、昵称或 Biu号（如：AI）..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {addMemberResults.map((u) => {
                const isInGroup = currentConversation?.members.some(m => m.userId === u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition">
                    <div className="flex items-center gap-3">
                      <AvatarWithBadge
                        fallback={u.nickname[0]}
                        badges={u.badges}
                        size="sm"
                      />
                      <div>
                        <p className="text-white font-display text-sm">{u.nickname}</p>
                        <p className="text-gray-500 text-xs">{u.biuId}</p>
                      </div>
                    </div>
                    {isInGroup ? (
                      <span className="text-gray-500 text-xs font-body">已在群聊</span>
                    ) : (
                      <button
                        onClick={() => handleAddMember(u.id)}
                        className="px-3 py-1.5 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-xs font-body"
                      >
                        添加
                      </button>
                    )}
                  </div>
                );
              })}
              {addMemberResults.length === 0 && addMemberKeyword && (
                <p className="text-gray-600 text-sm text-center py-4">未找到用户</p>
              )}
              {addMemberResults.length === 0 && !addMemberKeyword && (
                <p className="text-gray-600 text-sm text-center py-4">输入关键词搜索用户，输入"AI"找到AI账号</p>
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

      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[360px] p-6 animate-scale-in">
            <h2 className="text-white font-display font-700 text-lg mb-2">{showConfirmDialog.title}</h2>
            <p className="text-gray-400 text-sm font-body mb-6">{showConfirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition text-sm font-body"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAction}
                className="flex-1 py-2.5 rounded-xl bg-biu-accent text-white hover:bg-biu-accent/80 transition text-sm font-display font-600"
              >
                确定
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {showAnnouncement && currentConversation?.type === 'group' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[420px] p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-display font-700 text-lg flex items-center gap-2">
                <IconAnnouncement size={18} className="text-biu-primary" />
                群公告
              </h2>
              <button onClick={() => setShowAnnouncement(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <p className="text-gray-300 font-body mb-6 whitespace-pre-wrap">
              {currentConversation.announcement}
            </p>
            <button
              onClick={() => setShowAnnouncement(false)}
              className="w-full py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition text-sm font-body"
            >
              关闭
            </button>
          </GlassCard>
        </div>
      )}

      {showGroupSettings && currentConversation?.type === 'group' && (
        <div className="fixed inset-0 z-40 flex justify-end animate-fade-in">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGroupSettings(false)}
          />
          <div className="relative w-[320px] glass border-l border-white/5 flex flex-col animate-slide-in-from-right" style={{ animation: 'slideInFromRight 0.2s ease-out' }}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-white font-display font-700 text-sm">群设置</h2>
              <button onClick={() => setShowGroupSettings(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">群名称</label>
                  {isGroupOwner ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
                        placeholder="输入群名称"
                      />
                      <button
                        onClick={handleUpdateGroupName}
                        className="px-3 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <p className="px-3 py-2 rounded-lg bg-white/5 text-white text-sm">{currentConversation.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">群Biu号</label>
                  <p className="px-3 py-2 rounded-lg bg-white/5 text-white text-sm">{currentConversation.biuId}</p>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">我的群昵称</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editMyNickname}
                      onChange={(e) => setEditMyNickname(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body"
                      placeholder="输入群昵称"
                    />
                    <button
                      onClick={handleUpdateMyNickname}
                      className="px-3 py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm"
                    >
                      保存
                    </button>
                  </div>
                </div>

                {isGroupOwner && (
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">群公告</label>
                    <textarea
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="输入群公告内容..."
                      className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-600 outline-none font-body resize-none"
                      rows={4}
                    />
                    <button
                      onClick={handleSetAnnouncement}
                      className="mt-2 w-full py-2 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-sm"
                    >
                      保存公告
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <h3 className="text-gray-400 text-xs font-medium mb-3">群成员 ({currentConversation.members.length})</h3>
                  <div className="space-y-2">
                    {currentConversation.members.map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
                        <div className="flex items-center gap-2">
                          <AvatarWithBadge
                            fallback={(member.nickname || member.user?.nickname)[0]}
                            badges={member.user?.badges}
                            size="sm"
                          />
                          <div>
                            <p className="text-white text-sm font-display">
                              {member.nickname || member.user?.nickname}
                              {member.userId === currentConversation.ownerId && (
                                <span className="ml-2 text-xs text-biu-primary">群主</span>
                              )}
                            </p>
                            <p className="text-gray-500 text-xs">{member.user?.biuId}</p>
                          </div>
                        </div>
                        {isGroupOwner && member.userId !== user?.id && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.nickname || member.user?.nickname)}
                            className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs"
                          >
                            移除
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 space-y-2">
              <button
                onClick={handleLeaveGroup}
                className="w-full py-2.5 rounded-lg bg-white/5 text-white hover:bg-white/10 transition text-sm font-body"
              >
                退出群聊
              </button>
              {isGroupOwner && (
                <button
                  onClick={handleDissolveGroup}
                  className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-body"
                >
                  解散群聊
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      ` }} />

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
              {currentConversation.type === 'private' && otherUser && (
                <UserBadge badges={otherUser.user?.badges} size="sm" />
              )}
              {currentConversation.type === 'group' && (
                <>
                  <span className="ml-2 text-gray-500 text-xs font-body">
                    ({currentConversation.members.length}人)
                  </span>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-biu-primary/10 text-biu-primary hover:bg-biu-primary/20 transition text-xs font-body"
                  >
                    <IconPlus size={12} /> 添加成员
                  </button>
                  <button
                    onClick={handleOpenGroupSettings}
                    className="ml-2 w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition"
                    title="群管理"
                  >
                    <IconMore size={18} />
                  </button>
                </>
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
              {currentConversation?.type === 'group' && currentConversation?.announcement && !showAnnouncement && (
                <div 
                  className="mb-4 p-3 rounded-xl bg-biu-primary/10 border border-biu-primary/20 cursor-pointer flex items-start gap-2"
                  onClick={() => setShowAnnouncement(true)}
                >
                  <IconAnnouncement size={16} className="text-biu-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-biu-primary text-xs font-display font-600 mb-0.5">群公告</p>
                    <p className="text-gray-300 text-xs font-body truncate">{currentConversation.announcement}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAnnouncement(true);
                    }}
                    className="text-gray-400 hover:text-gray-300 shrink-0"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              )}
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
            {isSystemConversation ? (
              <div className="px-4 py-6 glass-strong border-t border-white/5 text-center">
                <p className="text-gray-500 text-sm font-body">系统通知，暂不支持发送消息</p>
              </div>
            ) : (
            <div className="px-4 pt-3 pb-4 glass-strong border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      showEmojiPicker
                        ? 'bg-biu-primary/20 text-biu-primary'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <IconEmoji size={14} />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
              </div>
              <div className="flex gap-3 items-end relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder="输入消息... @提及用户"
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                />
                {/* @ 提及下拉菜单 */}
                <AnimatePresence>
                  {showMentionDropdown && currentConversation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-72 glass-strong rounded-xl border border-white/10 shadow-xl overflow-hidden"
                    >
                      <div className="p-2 max-h-64 overflow-y-auto">
                        {/* 全体成员选项 */}
                        {currentConversation.type === 'group' && (
                          <button
                            onClick={() => handleSelectMention('all', '全体成员')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-biu-primary/20 flex items-center justify-center">
                              <IconUsers size={16} className="text-biu-primary" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">@全体成员</p>
                              <p className="text-gray-500 text-xs">提及群内所有成员</p>
                            </div>
                          </button>
                        )}
                        {/* 群成员列表 */}
                        {currentConversation.members
                          .filter(m => m.userId !== user?.id)
                          .filter(m => {
                            const nickname = m.user?.nickname || m.nickname || '';
                            const username = m.user?.username || '';
                            const search = mentionSearch.toLowerCase();
                            return !mentionSearch || 
                              nickname.toLowerCase().includes(search) || 
                              username.toLowerCase().includes(search);
                          })
                          .map(member => (
                            <button
                              key={member.userId}
                              onClick={() => handleSelectMention(member.userId, member.user?.nickname || '用户')}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left"
                            >
                              <AvatarWithBadge
                                fallback={(member.user?.nickname || '用户')[0]}
                                badges={member.user?.badges}
                                size="sm"
                              />
                              <div>
                                <p className="text-white text-sm font-medium">
                                  @{member.nickname || member.user?.nickname || '用户'}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  {member.user?.biuId}
                                </p>
                              </div>
                            </button>
                          ))
                        }
                        {currentConversation.members.filter(m => m.userId !== user?.id).length === 0 && (
                          <p className="text-gray-500 text-xs text-center py-4">没有可提及的用户</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 disabled:opacity-30 hover:shadow-glow"
                >
                  <IconSend size={18} />
                </button>
              </div>
            </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center animate-fade-in">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-biu-primary/8 border border-biu-primary/15 flex items-center justify-center mx-auto mb-5 animate-float">
                <IconChat size={32} className="text-biu-primary/70" />
              </div>
              <p className="text-gray-400 text-sm font-display font-500 mb-1">选择一个会话</p>
              <p className="text-gray-600 text-xs font-body">开始聊天</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
