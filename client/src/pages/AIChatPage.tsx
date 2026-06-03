import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import ChatBubble from '../components/ChatBubble';
import TimeSeparator from '../components/TimeSeparator';
import NewMessageDivider from '../components/NewMessageDivider';
import Toast from '../components/Toast';
import { IconChat, IconSend } from '../components/Icons';
import { formatSeparatorLabel, shouldShowSeparator } from '../utils/time';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const newMessageDividerRef = useRef<HTMLDivElement>(null);

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
    if (lastReadMessageId && newMessageDividerRef.current) {
      newMessageDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, lastReadMessageId]);

  const handleSend = () => {
    if (!input.trim() || !currentConversation) return;
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
    const other = conv.members.find((m) => m.userId !== user?.id);
    if (other?.user?.isSystem) return 'Biu团队';
    return other?.user?.nickname || '未知用户';
  };

  return (
    <div className="flex h-screen bg-biu-dark">
      <div className="w-72 glass border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-white font-display font-700 text-sm">AI 工作台</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full p-4 text-left border-b border-white/5 transition-all duration-200 ${
                currentConversation?.id === conv.id
                  ? 'bg-biu-primary/10 text-biu-primary'
                  : 'text-white hover:bg-white/5'
              }`}
            >
              <p className="text-sm font-display font-600 truncate">{convDisplayName(conv)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
              <h2 className="text-white font-display font-600 text-sm">{convDisplayName(currentConversation)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
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
                    />
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="px-4 pt-3 pb-4 glass-strong border-t border-white/5">
              <div className="flex gap-3 items-end">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body"
                  autoFocus
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-biu-primary/8 border border-biu-primary/15 flex items-center justify-center mx-auto mb-5">
                <IconChat size={32} className="text-biu-primary/70" />
              </div>
              <p className="text-gray-400 text-sm font-display font-500 mb-1">选择一个会话</p>
              <p className="text-gray-600 text-xs font-body">开始聊天</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
