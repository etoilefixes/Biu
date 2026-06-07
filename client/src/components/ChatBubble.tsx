import React, { useState, useMemo, useCallback } from 'react';
import { Message, CardData } from '@biu/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import UserBadge from './UserBadge';
import AvatarWithBadge from './AvatarWithBadge';
import { renderRich } from '../utils/mention';
import { formatExactTime } from '../utils/time';

interface Props {
  message: Message;
  isSelf: boolean;
  onCopy?: (content: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  memberMap?: Map<string, string>;
}

function CardMessage({ cardType, cardData }: { cardType?: string | null; cardData?: CardData | null }) {
  if (!cardType || !cardData) return null;

  if (cardType === 'welcome') {
    return (
      <div className="rounded-xl bg-gradient-to-br from-biu-primary/10 to-biu-primary/5 border border-biu-primary/20 p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">👋</span>
          <span className="text-biu-primary font-display font-600 text-sm">{cardData.title || '欢迎'}</span>
        </div>
        <p className="text-gray-300 text-xs font-body leading-relaxed">{cardData.body || ''}</p>
      </div>
    );
  }

  if (cardType === 'friend_welcome') {
    return (
      <div className="rounded-xl bg-gradient-to-br from-biu-accent/10 to-biu-accent/5 border border-biu-accent/20 p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🤝</span>
          <span className="text-biu-accent font-display font-600 text-sm">{cardData.title || '新朋友'}</span>
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

  if (cardType === 'broadcast') {
    return (
      <div className="rounded-xl bg-gradient-to-br from-biu-primary/15 to-biu-primary/5 border border-biu-primary/30 p-5 min-w-[220px]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📢</span>
          <span className="text-biu-primary font-display font-600 text-base">{cardData.title || '官方公告'}</span>
        </div>
        <p className="text-gray-200 text-sm font-body leading-relaxed">{cardData.body || ''}</p>
        <div className="mt-3 pt-3 border-t border-biu-primary/10">
          <span className="text-biu-primary/60 text-[11px] font-body">Biu 官方</span>
        </div>
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

/** AI 思考内容折叠组件 */
function ReasoningBlock({ reasoning, isStreaming }: { reasoning: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(isStreaming ?? false);

  if (!reasoning) return null;

  return (
    <div className="mb-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-biu-primary/60 hover:text-biu-primary text-xs font-body transition-colors group"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          思考过程
          {isStreaming && (
            <span className="inline-block w-1 h-1 rounded-full bg-biu-primary animate-pulse-subtle" />
          )}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="relative pl-3.5 border-l-2 border-biu-primary/30 bg-biu-primary/5 rounded-r-lg py-2 pr-3">
          <div className="text-gray-400 text-xs font-body leading-relaxed whitespace-pre-wrap chat-markdown-reasoning">
            {reasoning}
          </div>
          {isStreaming && (
            <span className="inline-block w-1 h-3 ml-0.5 bg-biu-primary/50 animate-pulse-subtle rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatBubble({ message, isSelf, onCopy, onDelete, onRetry, memberMap }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const status = (message as any)._status;
  const isCard = message.type === 'card';
  const isSystem = message.sender?.isSystem;
  const isStreaming = (message as any)._isStreaming;
  const streamingReasoning = (message as any)._streamingReasoning;
  const aiReasoning = message.cardType === 'ai_reasoning' && message.cardData && 'reasoning' in message.cardData ? message.cardData.reasoning : null;

  // AI 角色用户不显示 AI 徽章（本身已是 AI 会话，无需额外标识）
  const senderBadges = (message.sender as any)?.username?.startsWith('ai_role_')
    ? message.sender?.badges?.filter((b: any) => b.type !== 'AI')
    : message.sender?.badges;

  // 解析 @ 提及（富文本渲染）
  const renderedContent = useMemo(() => renderRich(message.content, memberMap), [message.content, memberMap]);


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
        className={`group flex ${isSelf ? 'justify-end' : 'justify-start'} mb-4 animate-message-in`}
        onContextMenu={handleContextMenu}
      >
        {!isSelf && (
          <AvatarWithBadge
            fallback={isSystem ? '🔔' : (message.sender?.nickname?.[0] || '?')}
            isSystem={isSystem}
            badges={senderBadges}
            size="md"
            className="mr-3 mt-0.5"
          />
        )}
        <div className="max-w-[60%] min-w-0">
          {!isSelf && message.sender?.nickname && (
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <p className="text-gray-500 text-xs font-body">{message.sender.nickname}</p>
              <UserBadge badges={senderBadges} size="sm" />
            </div>
          )}
          {isCard ? (
            <CardMessage cardType={message.cardType} cardData={message.cardData} />
          ) : (
            <div className={`px-3.5 py-2.5 ${isSelf ? 'bubble-self' : 'bubble-other'} ${status === 'failed' ? 'opacity-60' : ''}`}>
              {/* 思考内容（流式中或持久化） */}
              {(streamingReasoning || aiReasoning) && (
                <ReasoningBlock reasoning={streamingReasoning || aiReasoning} isStreaming={!!streamingReasoning} />
              )}
              <div className="text-sm break-words font-body leading-relaxed chat-markdown">
                {renderedContent.length === 1 && typeof renderedContent[0] === 'string' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      pre: ({ children, node, ...props }: any) => (
                        <div className="relative group/code">
                          <pre {...props} className="chat-pre-block">{children}</pre>
                          <button
                            onClick={() => {
                              const codeEl = node?.querySelector?.('code')?.textContent || '';
                              navigator.clipboard.writeText(codeEl);
                            }}
                            className="absolute top-2 right-2 px-2 py-1 rounded-md bg-white/10 text-gray-400 text-[10px] font-body opacity-0 group-hover/code:opacity-100 hover:bg-white/20 transition-all"
                          >
                            复制
                          </button>
                        </div>
                      ),
                      code: ({ className, children, ...props }: any) => {
                        const isInline = !className;
                        if (isInline) {
                          return <code className="chat-inline-code" {...props}>{children}</code>;
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                    }}
                  >
                    {renderedContent[0]}
                  </ReactMarkdown>
                ) : (
                  renderedContent
                )}
                {/* 流式打字光标 */}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-biu-primary/70 animate-pulse-subtle align-text-bottom rounded-sm" />
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 px-1">
            <span
              className="text-gray-600 text-[11px] font-body opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              title={formatExactTime(message.createdAt)}
            >
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {status === 'sending' && (
              <span className="text-gray-500 text-[11px] animate-pulse-subtle font-body">发送中</span>
            )}
            {status === 'sent' && (
              <span className="text-gray-600 text-[11px] font-body">已发送</span>
            )}
            {isStreaming && (
              <span className="text-biu-primary/60 text-[11px] animate-pulse-subtle font-body">AI 思考中</span>
            )}
            {status === 'failed' && (
              <button
                onClick={handleRetry}
                className="text-biu-accent text-[11px] hover:text-biu-accent/80 transition font-body"
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
