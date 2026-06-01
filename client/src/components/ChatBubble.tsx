import React, { useState } from 'react';
import { Message } from '@biu/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import UserBadge from './UserBadge';

interface Props {
  message: Message;
  isSelf: boolean;
  onCopy?: (content: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
}

function CardMessage({ cardType, cardData }: { cardType?: string | null; cardData?: any }) {
  if (!cardType || !cardData) return null;

  if (cardType === 'welcome') {
    return (
      <div className="rounded-xl bg-gradient-to-br from-biu-primary/10 to-biu-secondary/10 border border-biu-primary/20 p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">👋</span>
          <span className="text-biu-primary font-display font-600 text-sm">{cardData.title || '欢迎'}</span>
        </div>
        <p className="text-gray-300 text-xs font-body leading-relaxed">{cardData.body || ''}</p>
      </div>
    );
  }

  if (cardType === 'notification') {
    return (
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📢</span>
          <span className="text-blue-400 font-display font-600 text-sm">{cardData.title || '通知'}</span>
        </div>
        <p className="text-gray-300 text-xs font-body leading-relaxed">{cardData.body || ''}</p>
        {cardData.link && (
          <a href={cardData.link} target="_blank" rel="noopener noreferrer" className="text-biu-primary text-xs hover:underline mt-2 inline-block font-body">
            查看详情 →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 min-w-[200px]">
      <p className="text-white text-sm font-display font-600 mb-1">{cardData.title || cardType}</p>
      {cardData.body && <p className="text-gray-400 text-xs font-body">{cardData.body}</p>}
    </div>
  );
}

export default function ChatBubble({ message, isSelf, onCopy, onDelete, onRetry }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const status = (message as any)._status;
  const isCard = message.type === 'card';
  const isSystem = message.sender?.isSystem;

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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-display font-600 mr-3 shrink-0 mt-0.5 ${isSystem ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-biu-secondary/40 to-biu-secondary/20'}`}>
            {isSystem ? '🔔' : (message.sender?.nickname?.[0] || '?')}
          </div>
        )}
        <div className="max-w-[60%] min-w-0">
          {!isSelf && message.sender?.nickname && (
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <p className="text-gray-500 text-xs font-body">{message.sender.nickname}</p>
              <UserBadge badges={(message.sender as any).badges} size="sm" />
            </div>
          )}
          {isCard ? (
            <CardMessage cardType={message.cardType} cardData={message.cardData} />
          ) : (
            <div className={`px-3.5 py-2.5 ${isSelf ? 'bubble-self' : 'bubble-other'} ${status === 'failed' ? 'opacity-60' : ''}`}>
              <div className="text-sm break-words font-body leading-relaxed chat-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </div>
          )}
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
