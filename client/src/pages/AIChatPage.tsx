import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import ChatBubble from '../components/ChatBubble';
import TimeSeparator from '../components/TimeSeparator';
import NewMessageDivider from '../components/NewMessageDivider';
import Toast from '../components/Toast';
import { IconChat, IconSend, IconRefresh, IconHelpCircle, IconEraser, IconX } from '../components/Icons';
import { formatSeparatorLabel, shouldShowSeparator } from '../utils/time';

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

export default function AIChatPage() {
  const user = useAuthStore((s) => s.user);
  const {
    conversations,
    currentConversation,
    messages,
    lastReadMessageId,
    loadConversations,
    selectConversation,
    sendMessage,
    addMessage,
    removeMessage,
    markMessageFailed,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const newMessageDividerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  // 上次会话ID，用于检测会话切换（selectConversation不清空消息，仅靠消息数量无法可靠检测）
  const prevConversationIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 过滤命令列表
  const filteredCommands = useMemo(() => {
    if (!commandFilter) return SLASH_COMMANDS;
    const filter = commandFilter.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(filter) ||
        cmd.label.toLowerCase().includes(filter)
    );
  }, [commandFilter]);

  // 当选中的命令超出范围时重置
  useEffect(() => {
    if (selectedCommandIndex >= filteredCommands.length) {
      setSelectedCommandIndex(0);
    }
  }, [filteredCommands.length, selectedCommandIndex]);

  useEffect(() => {
    loadConversations();
    socketService.onMessage(addMessage);
    socketService.onChatError((data) => {
      const { messages } = useChatStore.getState();
      const sendingMsgs = messages.filter(
        (m) =>
          (m as any)._status === 'sending' &&
          m.conversationId === data.conversationId
      );
      if (sendingMsgs.length > 0) {
        const latest = sendingMsgs[sendingMsgs.length - 1];
        markMessageFailed(latest.id);
      }
      setToast({ message: data.message || '消息发送失败', type: 'error' });
    });
    return () => {
      socketService.offMessage();
      socketService.offChatError();
    };
  }, []);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;
    prevMessageCountRef.current = currentCount;

    // 切换会话检测：会话ID变化，或消息从0变为有数据
    const currentConvId = currentConversation?.id || null;
    const convChanged = prevConversationIdRef.current !== currentConvId;
    prevConversationIdRef.current = currentConvId;
    if (convChanged || (prevCount === 0 && currentCount > 0)) {
      shouldAutoScrollRef.current = true;
    }

    if (shouldAutoScrollRef.current) {
      if (lastReadMessageId && newMessageDividerRef.current) {
        newMessageDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
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

  // 检测斜杠命令
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.startsWith('/') && !value.includes(' ')) {
      setShowCommandPalette(true);
      setCommandFilter(value);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandPalette(false);
      setCommandFilter('');
    }
  };

  // 执行命令
  const executeCommand = async (cmd: SlashCommand) => {
    setShowCommandPalette(false);
    setInput('');

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

  // 清除上下文
  const handleClearContext = async () => {
    if (!currentConversation) return;
    setClearing(true);
    try {
      const res = await api.delete(`/ai-roles/conversations/${currentConversation.id}/messages`);
      const { aiRoleName, convName } = res.data?.data || {};
      setToast({ message: `${aiRoleName || 'AI'}在${convName || '本次会话'}的上下文已被清除`, type: 'success' });
      // 不需要重新加载消息，系统消息会通过 Socket 自动推送
    } catch (err: any) {
      setToast({ message: err.message || '清除失败', type: 'error' });
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  // 重新生成（仅 AI 角色会话支持）
  const handleRegenerate = async () => {
    if (!currentConversation) return;

    // 仅 AI 角色会话支持重新生成
    if (!currentConversation.name?.startsWith('__ai_role__')) {
      setToast({ message: '重新生成仅支持 AI 角色会话', type: 'error' });
      return;
    }

    // 检查是否有 AI 回复
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.senderId === user?.id) {
      setToast({ message: '没有可重新生成的 AI 回复', type: 'error' });
      return;
    }

    try {
      // 先移除前端中的最后一条 AI 消息（乐观更新）
      removeMessage(lastMsg.id);
      await api.post(`/ai-roles/conversations/${currentConversation.id}/regenerate`);
      setToast({ message: '正在重新生成...', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || '重新生成失败', type: 'error' });
      // 失败时重新加载消息
      await selectConversation(currentConversation);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !currentConversation) return;
    // 如果是斜杠命令，不发送
    if (input.startsWith('/')) {
      // 只输入 / 时显示帮助
      if (input === '/') {
        setShowCommandPalette(false);
        setInput('');
        setShowHelpModal(true);
        return;
      }
      const matchedCmd = filteredCommands.find((cmd) => cmd.command === input);
      if (matchedCmd) {
        executeCommand(matchedCmd);
        return;
      }
      // 未匹配的斜杠命令，不发送
      setToast({ message: '未知命令，输入 / 查看可用命令', type: 'error' });
      return;
    }
    sendMessage(input.trim(), 'text', user?.id);
    setInput('');
    shouldAutoScrollRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      if (e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          setInput(selected.command);
          setCommandFilter(selected.command);
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIndex];
        if (selected && input === selected.command) {
          executeCommand(selected);
        } else {
          // 输入不完整，补全到选中的命令
          if (selected) {
            setInput(selected.command);
            setCommandFilter(selected.command);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        return;
      }
    }

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

  // 构建 userId→nickname 映射，用于 @提及 渲染
  const memberMap = useMemo(() => {
    if (!currentConversation?.members) return undefined;
    return new Map(currentConversation.members.map((m: any) => [m.userId, m.nickname || m.user?.nickname]));
  }, [currentConversation?.members]);

  return (
    <div className="flex h-screen bg-biu-dark">
      <div className="w-72 glass border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <h1 className="text-white font-display font-700 text-sm tracking-wide">AI 工作台</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full p-4 text-left border-b border-white/[0.04] transition-all duration-200 ${
                currentConversation?.id === conv.id
                  ? 'bg-biu-primary/[0.06] border-l-2 border-l-biu-primary text-white'
                  : 'text-white hover:bg-white/[0.03] border-l-2 border-l-transparent'
              }`}
            >
              <p className="text-sm font-display font-600 truncate">{convDisplayName(conv)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* 帮助弹窗 */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative w-[420px] glass-strong rounded-2xl shadow-2xl p-6 animate-scale-in">
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
            </div>
          </div>
        )}

        {/* 清除确认弹窗 */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative w-[360px] glass-strong rounded-2xl shadow-2xl p-6 animate-scale-in">
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
            </div>
          </div>
        )}

        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/[0.06]">
              <h2 className="text-white font-display font-600 text-sm tracking-wide">{convDisplayName(currentConversation)}</h2>
            </div>
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
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
            <div className="px-4 pt-3 pb-4 glass-strong border-t border-white/[0.06] relative">
              {/* 命令面板 */}
              <AnimatePresence>
                {showCommandPalette && filteredCommands.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-4 right-4 mb-2"
                  >
                    <div className="glass-strong rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/5">
                        <span className="text-gray-500 text-xs font-body">命令</span>
                      </div>
                      {filteredCommands.map((cmd, index) => (
                        <button
                          key={cmd.command}
                          onClick={() => executeCommand(cmd)}
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex gap-3 items-end">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息或 / 使用命令..."
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark transition-all duration-200 disabled:opacity-30 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
                >
                  <IconSend size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center animate-fade-in">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-biu-primary/[0.06] border border-biu-primary/[0.12] flex items-center justify-center mx-auto mb-5 animate-float relative">
                <IconChat size={32} className="text-biu-primary/60" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-biu-primary/[0.04] to-transparent pointer-events-none" />
              </div>
              <p className="text-gray-300 text-sm font-display font-500 mb-1">选择一个会话</p>
              <p className="text-gray-600 text-xs font-body">开始聊天</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
