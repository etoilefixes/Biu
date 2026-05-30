import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import NavBar from '../components/NavBar';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';
import Toast from '../components/Toast';
import { IconSearch, IconSend } from '../components/Icons';

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const {
    conversations,
    currentConversation,
    messages,
    loadConversations,
    selectConversation,
    sendMessage,
    addMessage,
    removeMessage,
    setTyping,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isDragging = useRef(false);

  useEffect(() => {
    loadConversations();
    socketService.onMessage(addMessage);
    socketService.onTyping((data) => setTyping(data.conversationId, data.userId));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleCopy = (content: string) => {
    setToast({ message: '已复制到剪贴板', type: 'success' });
  };

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

  return (
    <div className="flex h-screen gradient-bg page-transition">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <NavBar />
      <div
        className="glass border-r border-white/5 flex flex-col shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="p-3 relative">
          <IconSearch size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full pl-8 pr-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-500 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv: any) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={currentConversation?.id === conv.id}
              onClick={() => selectConversation(conv)}
              currentUserId={user?.id || ''}
            />
          ))}
        </div>
      </div>
      <div
        className="w-1 shrink-0 resize-handle hover:bg-biu-primary/30 active:bg-biu-primary/50"
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
              <h2 className="text-white font-medium">{convDisplayName(currentConversation)}</h2>
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
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white placeholder-gray-500 outline-none focus:border-biu-primary transition"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white transition disabled:opacity-50"
                >
                  <IconSend size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 animate-fade-in">
            选择一个会话开始聊天
          </div>
        )}
      </div>
    </div>
  );
}
