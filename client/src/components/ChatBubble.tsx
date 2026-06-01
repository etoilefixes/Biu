import React, { useState } from 'react';
import { Message } from '@biu/shared';
import { renderContentWithEmoji } from '../utils/emoji';

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
        className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-4 animate-message-in`}
        onContextMenu={handleContextMenu}
      >
        {!isSelf && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/40 to-biu-secondary/20 flex items-center justify-center text-white text-sm font-display font-600 mr-3 shrink-0 mt-0.5">
            {message.sender?.nickname?.[0] || '?'}
          </div>
        )}
        <div className="max-w-[60%] min-w-0">
          {!isSelf && message.sender?.nickname && (
            <p className="text-gray-500 text-xs mb-1 font-body px-1">{message.sender.nickname}</p>
          )}
          <div className={`px-3.5 py-2.5 ${isSelf ? 'bubble-self' : 'bubble-other'} ${status === 'failed' ? 'opacity-60' : ''}`}>
            <p className="text-sm break-words font-body leading-relaxed">{renderContentWithEmoji(message.content)}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 px-1">
            <p className="text-gray-600 text-[10px] font-body">
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {status === 'sending' && (
              <span className="text-gray-500 text-[10px] animate-pulse-subtle font-body">发送中</span>
            )}
            {status === 'failed' && (
              <button
                onClick={handleRetry}
                className="text-biu-accent text-[10px] hover:text-biu-accent/80 transition font-body"
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
            className="fixed z-50 glass-strong rounded-xl py-1.5 min-w-[120px] context-menu shadow-glow"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 transition font-body"
            >
              复制
            </button>
            {isSelf && (
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-biu-accent hover:bg-white/5 transition font-body"
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
