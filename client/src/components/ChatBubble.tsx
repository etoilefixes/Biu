import React, { useState } from 'react';
import { Message } from '@biu/shared';

interface Props {
  message: Message;
  isSelf: boolean;
  onCopy?: (content: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
}

export default function ChatBubble({ message, isSelf, onCopy, onDelete, onRetry }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const status = (message as any)._status;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    onCopy?.(message.content);
    setShowMenu(false);
  };

  const handleDelete = () => {
    onDelete?.(message.id);
    setShowMenu(false);
  };

  const handleRetry = () => {
    onRetry?.(message.id);
    setShowMenu(false);
  };

  return (
    <>
      <div
        className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3 animate-message-in`}
        onContextMenu={handleContextMenu}
      >
        {!isSelf && (
          <div className="w-8 h-8 rounded-lg bg-biu-secondary/30 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">
            {message.sender?.nickname?.[0] || '?'}
          </div>
        )}
        <div className="max-w-[60%]">
          {!isSelf && (
            <p className="text-gray-500 text-xs mb-1">{message.sender?.nickname}</p>
          )}
          <div className={`px-4 py-2 ${isSelf ? 'bubble-self' : 'bubble-other'} ${status === 'failed' ? 'opacity-60' : ''}`}>
            <p className="text-white text-sm break-words">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600 text-xs">
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {status === 'sending' && (
              <span className="text-gray-500 text-xs animate-pulse-subtle">发送中</span>
            )}
            {status === 'failed' && (
              <button
                onClick={handleRetry}
                className="text-red-400 text-xs hover:text-red-300 transition"
              >
                发送失败，点击重试
              </button>
            )}
          </div>
        </div>
      </div>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="fixed z-50 glass-strong rounded-xl py-1 min-w-[120px] context-menu"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition"
            >
              复制
            </button>
            {isSelf && (
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10 transition"
              >
                删除
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
