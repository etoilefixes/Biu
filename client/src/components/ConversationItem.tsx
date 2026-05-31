import React from 'react';
import { Conversation, LastMessage } from '@biu/shared';

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  currentUserId: string;
  unreadCount: number;
}

function formatUnread(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export default function ConversationItem({ conversation, active, onClick, currentUserId, unreadCount }: Props) {
  const displayName =
    conversation.type === 'group'
      ? conversation.name
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname || '未知用户';

  const avatar =
    conversation.type === 'group'
      ? conversation.name?.[0] || '群'
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname?.[0] || '?';

  const lastMsg = conversation.lastMessage as LastMessage | null | undefined;
  const isSelf = lastMsg?.senderId === currentUserId;

  let preview = '暂无消息';
  if (lastMsg) {
    if (isSelf) {
      if (conversation.type === 'group') {
        preview = `你: ${lastMsg.content}`;
      } else {
        preview = lastMsg.content;
      }
    } else {
      const senderName = lastMsg.senderNickname || '对方';
      preview = `${senderName}: ${lastMsg.content}`;
    }
  }

  const badge = formatUnread(unreadCount);

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-biu-primary/10 border-l-2 border-biu-primary'
          : 'hover:bg-white/[0.03] border-l-2 border-transparent'
      }`}
    >
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10 flex items-center justify-center text-white text-sm font-display font-600">
          {avatar}
        </div>
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-white text-sm font-medium font-display truncate">{displayName}</span>
        </div>
        <p className="text-gray-500 text-xs truncate mt-0.5 font-body">
          {preview}
        </p>
      </div>
    </div>
  );
}
