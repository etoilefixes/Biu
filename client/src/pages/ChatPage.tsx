import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useFriendStore } from '../store/friendStore';
import { useNotification } from '../hooks/useNotification';
import { useNotificationStore } from '../store/notificationStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';
import TimeSeparator from '../components/TimeSeparator';
import NewMessageDivider from '../components/NewMessageDivider';
import EmojiPicker from '../components/EmojiPicker';
import Toast from '../components/Toast';
import GlassCard from '../components/GlassCard';
import UserBadge from '../components/UserBadge';
import AvatarWithBadge from '../components/AvatarWithBadge';
import { formatSeparatorLabel, shouldShowSeparator } from '../utils/time';
import { IconSearch, IconSend, IconChat, IconX, IconCheck, IconAddFriend, IconGroup, IconEmoji, IconPlus, IconMore, IconUsers, IconSettings, IconEdit, IconTrash, IconAnnouncement, IconRobot, IconRefresh, IconHelpCircle, IconEraser } from '../components/Icons';
import AiRoleModal from '../components/AiRoleModal';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/clear',
    label: '清除上下文',
    description: '清除当前会话的所有历史消息，让 AI 重新开始对话',
    icon: <IconEraser size={16} />,
    color: 'text-orange-400',
  },
  {
    command: '/regenerate',
    label: '重新生成',
    description: '删除 AI 的最后一条回复并重新生成',
    icon: <IconRefresh size={16} />,
    color: 'text-blue-400',
  },
  {
    command: '/help',
    label: '帮助',
    description: '查看所有可用的斜杠命令',
    icon: <IconHelpCircle size={16} />,
    color: 'text-green-400',
  },
];

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const notifyRef = useNotification();
  const {
    conversations,
    currentConversation,
    messages,
    unreadMap,
    totalUnread,
    lastReadMessageId,
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const newMessageDividerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 是否应该自动滚动到底部（切换会话或自己发消息时为true）
  const shouldAutoScrollRef = useRef(true);
  // 上次消息数量，用于判断是否是新消息到达
  const prevMessageCountRef = useRef(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isDragging = useRef(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAiRoleModal, setShowAiRoleModal] = useState(false);
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
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录输入框中的 @ 提及映射：displayName → userId，发送时替换为 [at:userId]
  const mentionMapRef = useRef<Map<string, string>>(new Map());
  // useMemo 缓存 @ 下拉菜单过滤结果，避免每次渲染都 .filter()
  const filteredMentionMembers = useMemo(() => {
    if (!currentConversation?.members) return [];
    const search = mentionSearch.toLowerCase();
    return currentConversation.members
      .filter(m => m.userId !== user?.id)
      .filter(m => {
        if (!search) return true;
        const nickname = m.user?.nickname || m.nickname || '';
        const username = m.user?.username || '';
        return nickname.toLowerCase().includes(search) || username.toLowerCase().includes(search);
      });
  }, [currentConversation?.members, mentionSearch, user?.id]);
  const inputRef = useRef<HTMLDivElement>(null);
  const savedSelectionRange = useRef<Range | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [groupSettingsMode, setGroupSettingsMode] = useState<'info' | 'announcement' | 'members'>('info');
  const [announcementText, setAnnouncementText] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editMyNickname, setEditMyNickname] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ type: 'leave' | 'dissolve' | 'remove' | 'transfer'; memberId?: string; title: string; message: string } | null>(null);
  const groupSettingsRef = useRef<HTMLDivElement>(null);
  const [dismissedAnnouncementConvIds, setDismissedAnnouncementConvIds] = useState<Set<string>>(new Set());

  // 斜杠命令
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filteredCommands = useMemo(() => {
    if (!commandFilter) return SLASH_COMMANDS;
    const filter = commandFilter.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(filter) ||
        cmd.label.toLowerCase().includes(filter)
    );
  }, [commandFilter]);

  useEffect(() => {
    if (selectedCommandIndex >= filteredCommands.length) {
      setSelectedCommandIndex(0);
    }
  }, [filteredCommands.length, selectedCommandIndex]);

  useEffect(() => {
    loadConversations();
    api.get('/friends').then((res: any) => setFriends(res.data)).catch(() => {});
    socketService.onMessage((msg) => {
      addMessage(msg);
      notifyRef.current(msg);
    });
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
    socketService.onChatAck((data) => {
      // ack 到达说明服务器已收到消息，将 sending 状态改为 sent
      // 这样超时定时器不会再触发重试
      const { messages } = useChatStore.getState();
      const sendingMsg = messages.find(
        (m) =>
          (m as any)._status === 'sending' &&
          m.conversationId === data.conversationId
      );
      if (sendingMsg) {
        useChatStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === sendingMsg.id ? { ...m, _status: 'sent' } : m
          ),
        }));
      }
    });
    socketService.onChatStream((data) => {
      useChatStore.getState().handleStreamEvent(data);
    });
    useChatStore.getState().cleanupStaleSending();

    // 监听 Socket 重连，自动重发失败消息
    const unsubscribe = socketService.onConnectionChange((connected) => {
      if (connected) {
        useChatStore.getState().retryFailedMessages();
      }
    });

    return () => {
      socketService.offMessage();
      socketService.offTyping();
      socketService.offUnread();
      socketService.offChatError();
      socketService.offChatAck();
      socketService.offChatStream();
      unsubscribe();
    };
  }, []);

  // 智能滚动逻辑：
  // 1. 切换会话时：滚动到新消息分割线或底部
  // 2. 自己发消息时：自动滚动到底部
  // 3. 收到新消息时：如果已在底部附近则自动滚动，否则不干扰用户浏览历史
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;
    prevMessageCountRef.current = currentCount;

    // 切换会话（消息从0变为有数据，或会话ID变化）
    if (prevCount === 0 && currentCount > 0) {
      shouldAutoScrollRef.current = true;
    }

    if (shouldAutoScrollRef.current) {
      if (lastReadMessageId && newMessageDividerRef.current) {
        newMessageDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      // 只在首次加载时自动滚动，之后需要判断位置
      if (prevCount > 0) {
        shouldAutoScrollRef.current = false;
      }
      return;
    }

    // 收到新消息时：判断是否在底部附近
    if (currentCount > prevCount) {
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [messages, lastReadMessageId]);

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

  // 从 contenteditable 提取文本，将 mention chip 转换为协议格式
  const extractInputContent = (): string => {
    const el = inputRef.current;
    if (!el) return '';
    let text = (el.textContent || '').replace(/\u200B/g, '');
    // 将 @displayName 替换为 [at:userId]
    mentionMapRef.current.forEach((userId, displayName) => {
      text = text.split(`@${displayName}`).join(`[at:${userId}]`);
    });
    return text;
  };

  const handleSend = () => {
    const text = extractInputContent().trim();
    if (!text) return;

    // 斜杠命令拦截
    if (text.startsWith('/')) {
      if (text === '/') {
        setShowCommandPalette(false);
        if (inputRef.current) inputRef.current.innerHTML = '';
        setShowHelpModal(true);
        return;
      }
      const matchedCmd = filteredCommands.find((cmd) => cmd.command === text);
      if (matchedCmd) {
        executeCommand(matchedCmd);
        if (inputRef.current) inputRef.current.innerHTML = '';
        return;
      }
      setToast({ message: '未知命令，输入 / 查看可用命令', type: 'error' });
      return;
    }

    sendMessage(text, 'text', user?.id);
    shouldAutoScrollRef.current = true;
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
    }
    mentionMapRef.current.clear();
  };

  const executeCommand = async (cmd: SlashCommand) => {
    setShowCommandPalette(false);
    if (inputRef.current) inputRef.current.innerHTML = '';
    mentionMapRef.current.clear();

    switch (cmd.command) {
      case '/clear':
        setShowClearConfirm(true);
        break;
      case '/help':
        setShowHelpModal(true);
        break;
      case '/regenerate':
        await handleRegenerate();
        break;
    }
  };

  const handleClearContext = async () => {
    if (!currentConversation) return;
    setClearing(true);
    try {
      await api.delete(`/ai-roles/conversations/${currentConversation.id}/messages`);
      await loadConversations();
      await selectConversation(currentConversation);
      setToast({ message: '上下文已清除', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || '清除失败', type: 'error' });
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentConversation) return;

    if (!currentConversation.name?.startsWith('__ai_role__')) {
      setToast({ message: '重新生成仅支持 AI 角色会话', type: 'error' });
      return;
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.senderId === user?.id) {
      setToast({ message: '没有可重新生成的 AI 回复', type: 'error' });
      return;
    }

    try {
      removeMessage(lastMsg.id);
      await api.post(`/ai-roles/conversations/${currentConversation.id}/regenerate`);
      setToast({ message: '正在重新生成...', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || '重新生成失败', type: 'error' });
      await selectConversation(currentConversation);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 命令面板键盘操作
    if (showCommandPalette) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          // 预选：填入完整命令到输入框，不直接执行
          replaceSlashCommandInput(selected.command);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        return;
      }
    }

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

  // 替换输入框中的斜杠命令文本
  const replaceSlashCommandInput = (command: string) => {
    const el = inputRef.current;
    if (!el) return;

    // 找到以 / 开头的文本节点并替换
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let slashNode: Text | null = null;
    let slashNodeOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent || '';
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex !== -1) {
        slashNode = node;
        slashNodeOffset = slashIndex;
        break;
      }
    }

    if (slashNode) {
      const before = (slashNode.textContent || '').substring(0, slashNodeOffset);
      slashNode.textContent = before + command + ' \u200B';

      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStart(slashNode, slashNode.textContent.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    setCommandFilter(command);
    setShowCommandPalette(false);
  };
  
  // 处理输入框变化，检测 @ 触发（contenteditable）
  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    // 获取光标前的文本（仅用 Range.toString，避免遍历 childNodes）
    const sel = window.getSelection();
    let textBeforeCursor = '';
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      savedSelectionRange.current = range.cloneRange();
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      textBeforeCursor = preRange.toString().replace(/\u200B/g, '');
    }

    // 斜杠命令检测（同步，无防抖）
    const lastSlash = textBeforeCursor.lastIndexOf('/');
    if (lastSlash !== -1) {
      const textAfterSlash = textBeforeCursor.slice(lastSlash + 1);
      const beforeSlash = lastSlash === 0 || textBeforeCursor[lastSlash - 1] === ' ' || textBeforeCursor[lastSlash - 1] === '\n';
      if (beforeSlash && !textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
        setShowCommandPalette(true);
        setCommandFilter('/' + textAfterSlash);
        setSelectedCommandIndex(0);
      } else {
        setShowCommandPalette(false);
        setCommandFilter('');
      }
    } else {
      setShowCommandPalette(false);
      setCommandFilter('');
    }

    // @ 提及检测（防抖 100ms：减少快速输入时的 setState 调用）
    if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
    mentionDebounceRef.current = setTimeout(() => {
      const lastAt = textBeforeCursor.lastIndexOf('@');
      if (lastAt !== -1) {
        const textAfter = textBeforeCursor.slice(lastAt + 1);
        const beforeAt = lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ';
        if (beforeAt && !textAfter.includes(' ') && !textAfter.includes('\n')) {
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
    }, 100);
  }, []);
  
  // 选择要 @ 的用户 → 插入 mention chip
  const handleSelectMention = (userId: string, displayName: string) => {
    const el = inputRef.current;
    if (!el) return;

    // 使用保存的光标位置（点击下拉菜单会导致 contenteditable 失焦）
    const savedRange = savedSelectionRange.current;
    if (!savedRange) return;
    const range = savedRange.cloneRange();

    // 在光标前文本中查找最后一个 @
    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString().replace(/\u200B/g, '');
    const atPos = textBefore.lastIndexOf('@');

    if (atPos === -1) return;

    // 定位到 @ 字符的起始位置
    let charCount = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = (node.textContent || '').replace(/\u200B/g, '').length;
      if (charCount + len > atPos) {
        startNode = node;
        // 需要考虑零宽空格的偏移
        const rawText = node.textContent || '';
        let adjustedOffset = 0;
        let visibleCount = 0;
        for (let i = 0; i < rawText.length; i++) {
          if (rawText[i] !== '\u200B') {
            if (visibleCount === atPos - charCount) {
              adjustedOffset = i;
              break;
            }
            visibleCount++;
          }
        }
        if (visibleCount < atPos - charCount) adjustedOffset = rawText.length;
        startOffset = adjustedOffset;
        break;
      }
      charCount += len;
    }
    if (!startNode) return;

    range.setStart(startNode, startOffset);

    // 插入 @displayName 纯文本，记录映射供发送时转换
    const mentionText = `@${displayName}`;
    mentionMapRef.current.set(displayName, userId);
    range.deleteContents();
    const textNode = document.createTextNode(mentionText + ' ');
    range.insertNode(textNode);

    // 将光标移到插入文本之后
    el.focus();
    const newRange = document.createRange();
    newRange.setStart(textNode, mentionText.length + 1);
    newRange.collapse(true);
    const newSel = window.getSelection();
    newSel?.removeAllRanges();
    newSel?.addRange(newRange);

    setShowMentionDropdown(false);
    setMentionSearch('');
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
    if (conv.type === 'group') {
      if (conv.name?.startsWith('__ai_role__')) {
        return conv.members.find((m) => m.user?.username?.startsWith('ai_role_'))?.user?.nickname || 'AI 助手';
      }
      return conv.name;
    }
    const other = conv.members.find((m) => m.userId !== user?.id);
    if (other?.user?.isSystem) return 'Biu团队';
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

  const handleSetRole = async (memberId: string, role: 'admin' | 'member') => {
    if (!currentConversation) return;
    try {
      await api.put(`/conversations/${currentConversation.id}/role`, { memberId, role });
      setToast({ message: role === 'admin' ? '已设为管理员' : '已取消管理员', type: 'success' });
      await loadConversations();
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '设置失败', type: 'error' });
    }
  };

  const handleTransferOwner = (memberId: string, nickname: string) => {
    setShowConfirmDialog({
      type: 'transfer',
      memberId,
      title: '转让群主',
      message: `确定要将群主转让给「${nickname}」吗？你将变为普通成员。`,
    });
  };

  const handleConfirmTransferOwner = async () => {
    if (!currentConversation || !showConfirmDialog?.memberId) return;
    try {
      await api.put(`/conversations/${currentConversation.id}/transfer-owner`, {
        newOwnerUserId: showConfirmDialog.memberId,
      });
      setToast({ message: '群主已转让', type: 'success' });
      await loadConversations();
      setShowConfirmDialog(null);
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || '转让失败', type: 'error' });
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
      case 'transfer':
        handleConfirmTransferOwner();
        break;
    }
  };

  const isGroupOwner = currentConversation?.ownerId === user?.id;
  const myMemberRole = currentConversation?.members?.find((m: any) => m.userId === user?.id)?.role || 'member';
  const isGroupAdmin = myMemberRole === 'admin';
  const canManage = isGroupOwner || isGroupAdmin;

  // 构建 userId→nickname 映射，用于 @提及 渲染
  const memberMap = useMemo(() => {
    if (!currentConversation?.members) return undefined;
    return new Map(currentConversation.members.map((m: any) => [m.userId, m.nickname || m.user?.nickname]));
  }, [currentConversation?.members]);

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
                className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
              >
                <IconSearch size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {addFriendResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-colors duration-150">
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
                      className="p-2 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150"
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
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-colors duration-150">
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
                        className="px-3 py-1.5 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-xs font-body"
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
                        ? 'bg-biu-primary/[0.12] ring-1 ring-biu-primary/40'
                        : 'hover:bg-white/[0.04]'
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
              className="w-full py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-600 transition-all duration-200 disabled:opacity-30 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99]"
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
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white hover:bg-white/[0.10] transition-colors duration-150 text-sm font-body"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAction}
                className="flex-1 py-2.5 rounded-xl bg-biu-accent text-white hover:bg-biu-accent/80 transition-colors duration-150 text-sm font-display font-600"
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
              className="w-full py-2.5 rounded-xl bg-white/[0.05] text-white hover:bg-white/[0.10] transition-colors duration-150 text-sm font-body"
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
          <div className="relative w-[320px] glass border-l border-white/[0.06] flex flex-col animate-slide-in-from-right" style={{ animation: 'slideInFromRight 0.2s ease-out' }}>
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-white font-display font-700 text-sm">群设置</h2>
              <button onClick={() => setShowGroupSettings(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">群名称</label>
                  {canManage ? (
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
                      className="px-3 py-2 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-sm"
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
                      className="px-3 py-2 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-sm"
                    >
                      保存
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-xs font-medium">消息免打扰</p>
                      <p className="text-gray-600 text-[11px] font-body">开启后不再弹出此会话的通知</p>
                    </div>
                    <MuteToggle conversationId={currentConversation.id} />
                  </div>
                </div>

                {canManage && (
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
                      className="mt-2 w-full py-2 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-sm"
                    >
                      保存公告
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <h3 className="text-gray-400 text-xs font-medium mb-3">群成员 ({currentConversation.members.length})</h3>
                  <div className="space-y-2">
                    {currentConversation.members.map((member: any) => {
                      const memberRole = member.role || 'member';
                      const isMe = member.userId === user?.id;
                      return (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors duration-150">
                          <div className="flex items-center gap-2">
                            <AvatarWithBadge
                              fallback={(member.nickname || member.user?.nickname)[0]}
                              badges={member.user?.badges}
                              size="sm"
                            />
                            <div>
                              <p className="text-white text-sm font-display flex items-center gap-1.5">
                                {member.nickname || member.user?.nickname}
                                {memberRole === 'owner' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-biu-primary/15 text-biu-primary font-body">群主</span>
                                )}
                                {memberRole === 'admin' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-body">管理员</span>
                                )}
                              </p>
                              <p className="text-gray-500 text-xs">{member.user?.biuId}</p>
                            </div>
                          </div>
                          {!isMe && (
                            <div className="flex items-center gap-1">
                              {isGroupOwner && memberRole !== 'owner' && (
                                <button
                                  onClick={() => handleSetRole(member.id, memberRole === 'admin' ? 'member' : 'admin')}
                                  className={`px-2 py-1 rounded text-xs transition-colors duration-150 ${
                                    memberRole === 'admin'
                                      ? 'bg-amber-500/[0.10] text-amber-400 hover:bg-amber-500/20'
                                      : 'bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20'
                                  }`}
                                >
                                  {memberRole === 'admin' ? '取消管理' : '设为管理'}
                                </button>
                              )}
                              {canManage && (memberRole === 'member' || isGroupOwner) && (
                                <button
                                  onClick={() => handleRemoveMember(member.id, member.nickname || member.user?.nickname)}
                                  className="px-2 py-1 rounded bg-red-500/[0.10] text-red-400 hover:bg-red-500/20 transition-colors duration-150 text-xs"
                                >
                                  移除
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/[0.06] space-y-2">
              <button
                onClick={handleLeaveGroup}
                className="w-full py-2.5 rounded-lg bg-white/[0.05] text-white hover:bg-white/[0.10] transition-colors duration-150 text-sm font-body"
              >
                退出群聊
              </button>
              {isGroupOwner && (
                <button
                  onClick={handleDissolveGroup}
                  className="w-full py-2.5 rounded-lg bg-biu-accent/[0.08] text-biu-accent hover:bg-biu-accent/20 transition-colors duration-150 text-sm font-body"
                >
                  解散群聊
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="glass border-r border-white/[0.06] flex flex-col shrink-0"
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
              className="w-10 h-10 rounded-xl bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 flex items-center justify-center transition-colors duration-150 shrink-0"
              title="添加"
            >
              <IconAddFriend size={18} />
            </button>
            {showAddDropdown && (
              <div className="absolute right-0 top-12 z-40 animate-scale-in">
                <GlassCard className="w-40 py-1.5">
                  <button
                    onClick={handleOpenAddFriendModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors duration-150 font-body"
                  >
                    <IconAddFriend size={16} className="text-biu-primary" /> 添加好友
                  </button>
                  <button
                    onClick={handleOpenGroupModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors duration-150 font-body"
                  >
                    <IconGroup size={16} className="text-biu-primary" /> 发起群聊
                  </button>
                  <button
                    onClick={() => { setShowAddDropdown(false); setShowAiRoleModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors duration-150 font-body"
                  >
                    <IconRobot size={16} className="text-biu-primary" /> AI 角色
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
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/[0.06]">
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
                    className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-xs font-body"
                  >
                    <IconPlus size={12} /> 添加成员
                  </button>
                  <button
                    onClick={handleOpenGroupSettings}
                    className="ml-2 w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors duration-150"
                    title="群管理"
                  >
                    <IconMore size={18} />
                  </button>
                </>
              )}
              {currentConversation.type === 'private' && otherUser && !isFriend(otherUser.userId) && (
                <button
                  onClick={() => handleSendFriendRequest(otherUser.userId)}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-biu-primary/[0.10] text-biu-primary hover:bg-biu-primary/20 transition-colors duration-150 text-xs font-body"
                >
                  <IconAddFriend size={12} /> 添加到通讯录
                </button>
              )}
            </div>
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
              {currentConversation?.type === 'group' && currentConversation?.announcement && !showAnnouncement && !dismissedAnnouncementConvIds.has(currentConversation.id) && (
                <div 
                  className="mb-4 p-3 rounded-xl bg-biu-primary/[0.08] border border-biu-primary/[0.15] cursor-pointer flex items-start gap-2 transition-colors duration-150 hover:bg-biu-primary/[0.12]"
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
                      setDismissedAnnouncementConvIds(prev => new Set(prev).add(currentConversation.id));
                    }}
                    className="text-gray-400 hover:text-gray-300 shrink-0"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              )}
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showSep = shouldShowSeparator(msg.createdAt, prevMsg?.createdAt ?? null);
                const isDivider = msg.id === lastReadMessageId;
                return (
                  <React.Fragment key={msg.id}>
                    {showSep && (
                      <TimeSeparator label={formatSeparatorLabel(msg.createdAt)} />
                    )}
                    {isDivider && (
                      <div ref={newMessageDividerRef}>
                        <NewMessageDivider />
                      </div>
                    )}
                    <ChatBubble
                      message={msg}
                      isSelf={msg.senderId === user?.id}
                      onCopy={handleCopy}
                      onDelete={handleDeleteMessage}
                      onRetry={handleRetryMessage}
                      memberMap={memberMap}
                    />
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {isSystemConversation ? (
              <div className="px-4 py-6 glass-strong border-t border-white/[0.06] text-center">
                <p className="text-gray-500 text-sm font-body">系统通知，暂不支持发送消息</p>
              </div>
            ) : (
            <div className="px-4 pt-3 pb-4 glass-strong border-t border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      showEmojiPicker
                        ? 'bg-biu-primary/20 text-biu-primary'
                        : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <IconEmoji size={14} />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji) => {
                        const el = inputRef.current;
                        if (el) {
                          el.focus();
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(document.createTextNode(emoji));
                            range.collapse(false);
                          } else {
                            el.appendChild(document.createTextNode(emoji));
                          }
                        }
                        setShowEmojiPicker(false);
                        handleInput();
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
              </div>
              <div className="flex gap-3 items-end relative">
                <div
                  ref={inputRef}
                  contentEditable
                  role="textbox"
                  aria-placeholder="输入消息... /命令 @提及用户"
                  className="flex-1 min-h-[44px] max-h-[120px] px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body overflow-y-auto"
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowEmojiPicker(false)}
                  style={{
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                />
                {/* 斜杠命令面板 */}
                <AnimatePresence>
                  {showCommandPalette && filteredCommands.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-72 glass-strong rounded-xl border border-white/10 shadow-xl overflow-hidden z-10"
                    >
                      <div className="px-3 py-2 border-b border-white/5">
                        <span className="text-gray-500 text-xs font-body">命令</span>
                      </div>
                      {filteredCommands.map((cmd, index) => (
                        <button
                          key={cmd.command}
                          onClick={() => replaceSlashCommandInput(cmd.command)}
                          className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-all duration-150 ${
                            index === selectedCommandIndex
                              ? 'bg-biu-primary/15'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${cmd.color}`}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-mono font-600">{cmd.command}</span>
                              <span className="text-gray-400 text-xs font-body">{cmd.label}</span>
                            </div>
                            <p className="text-gray-600 text-[11px] font-body truncate">{cmd.description}</p>
                          </div>
                          {index === selectedCommandIndex && (
                            <span className="text-gray-600 text-[10px] font-body shrink-0">↵ 执行</span>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
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
                        {filteredMentionMembers.map(member => {
                          const initial = (member.user?.nickname || member.nickname || '用户')[0];
                          return (
                            <button
                              key={member.userId}
                              onClick={() => handleSelectMention(member.userId, member.user?.nickname || '用户')}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left"
                            >
                              <div className="w-8 h-8 rounded-lg bg-biu-primary/15 flex items-center justify-center text-biu-primary text-xs font-bold shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-medium truncate">
                                  @{member.nickname || member.user?.nickname || '用户'}
                                </p>
                                <p className="text-gray-500 text-xs truncate">
                                  {member.user?.biuId}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                        {filteredMentionMembers.length === 0 && (
                          <p className="text-gray-500 text-xs text-center py-4">没有可提及的用户</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={handleSend}
                  className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 disabled:opacity-30 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
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
              <div className="w-20 h-20 rounded-2xl bg-biu-primary/[0.06] border border-biu-primary/[0.12] flex items-center justify-center mx-auto mb-5 animate-float relative">
                <IconChat size={32} className="text-biu-primary/60" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-biu-primary/[0.04] to-transparent pointer-events-none" />
              </div>
              <p className="text-gray-300 text-sm font-display font-500 mb-1">选择一个会话</p>
              <p className="text-gray-500 text-xs font-body">开始聊天</p>
            </div>
          </div>
        )}
      </div>
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[420px] p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <IconHelpCircle size={20} className="text-biu-primary" />
                <h3 className="text-white font-display font-600 text-sm">可用命令</h3>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-gray-500 hover:text-white transition">
                <IconX size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {SLASH_COMMANDS.map((cmd) => (
                <div key={cmd.command} className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${cmd.color}`}>
                    {cmd.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-biu-primary text-sm font-mono font-600">{cmd.command}</code>
                      <span className="text-gray-500 text-xs font-body">{cmd.label}</span>
                    </div>
                    <p className="text-gray-500 text-xs font-body mt-0.5">{cmd.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs font-body mt-4 text-center">
              在输入框中输入 <code className="text-biu-primary">/</code> 开始使用命令
            </p>
          </GlassCard>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-[360px] p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <IconEraser size={18} className="text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-display font-600 text-sm">清除上下文</h3>
                <p className="text-gray-500 text-xs font-body">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm font-body mb-5">
              将删除当前会话的所有历史消息，AI 将失去之前的对话记忆并重新开始。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-body hover:bg-white/10 transition"
              >
                取消
              </button>
              <button
                onClick={handleClearContext}
                disabled={clearing}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-body font-500 hover:bg-orange-600 transition disabled:opacity-50"
              >
                {clearing ? '清除中...' : '确认清除'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {showAiRoleModal && (
        <AiRoleModal onClose={() => setShowAiRoleModal(false)} />
      )}
    </>
  );
}

/** 免打扰开关组件 */
function MuteToggle({ conversationId }: { conversationId: string }) {
  const isMuted = useNotificationStore((s) => s.isConversationMuted(conversationId));
  const setConversationMuted = useNotificationStore((s) => s.setConversationMuted);

  return (
    <button
      onClick={() => setConversationMuted(conversationId, !isMuted)}
      className={`w-10 h-6 rounded-full transition-all duration-200 relative ${isMuted ? 'bg-biu-primary' : 'bg-white/10'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${isMuted ? 'left-5' : 'left-1'}`} />
    </button>
  );
}
