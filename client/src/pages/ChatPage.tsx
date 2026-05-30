import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import NavBar from '../components/NavBar';
import ConversationItem from '../components/ConversationItem';
import ChatBubble from '../components/ChatBubble';

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
    setTyping,
  } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    socketService.onMessage(addMessage);
    socketService.onTyping((data) => setTyping(data.conversationId, data.userId));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const convDisplayName = (conv: typeof currentConversation) => {
    if (!conv) return '';
    if (conv.type === 'group') return conv.name;
    return conv.members.find((m) => m.userId !== user?.id)?.user?.nickname || '未知用户';
  };

  return (
    <div className="flex h-screen gradient-bg">
      <NavBar />
      <div className="w-[280px] glass border-r border-white/5 flex flex-col">
        <div className="p-3">
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm placeholder-gray-500 outline-none"
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
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            <div className="h-14 glass-strong flex items-center px-6 border-b border-white/5">
              <h2 className="text-white font-medium">{convDisplayName(currentConversation)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} isSelf={msg.senderId === user?.id} />
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
                  className="px-6 py-3 rounded-xl bg-biu-primary hover:bg-biu-secondary text-white font-medium transition disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            选择一个会话开始聊天
          </div>
        )}
      </div>
    </div>
  );
}
