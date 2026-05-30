import React from 'react';
import { Conversation } from '@biu/shared';

interface Props {
  conversation: Conversation & { lastMessage?: { content: string; createdAt: string } | null };
  active: boolean;
  onClick: () => void;
  currentUserId: string;
}

export default function ConversationItem({ conversation, active, onClick, currentUserId }: Props) {
  const displayName =
    conversation.type === 'group'
      ? conversation.name
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname || '未知用户';

  const avatar =
    conversation.type === 'group'
      ? conversation.name?.[0] || '群'
      : conversation.members.find((m) => m.userId !== currentUserId)?.user?.nickname?.[0] || '?';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-biu-primary/10 border-l-2 border-biu-primary'
          : 'hover:bg-white/[0.03] border-l-2 border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10 flex items-center justify-center text-white text-sm font-display font-600 shrink-0">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-white text-sm font-medium font-display truncate">{displayName}</span>
        </div>
        <p className="text-gray-600 text-xs truncate mt-0.5 font-body">
          {(conversation as any).lastMessage?.content || '暂无消息'}
        </p>
      </div>
    </div>
  );
}
