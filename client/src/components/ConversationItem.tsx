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
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
        active ? 'bg-biu-primary/20' : 'hover:bg-white/5'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-biu-secondary/30 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-white text-sm font-medium truncate">{displayName}</span>
        </div>
        <p className="text-gray-500 text-xs truncate mt-0.5">
          {(conversation as any).lastMessage?.content || '暂无消息'}
        </p>
      </div>
    </div>
  );
}
