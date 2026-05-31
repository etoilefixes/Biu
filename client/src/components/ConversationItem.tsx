import React, { useRef, useState, useCallback } from 'react';
import { Conversation, LastMessage } from '@biu/shared';
import { IconDeleteSwipe } from './Icons';

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  currentUserId: string;
  unreadCount: number;
  onDelete: (conversationId: string) => void;
}

function formatUnread(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 72;

export default function ConversationItem({ conversation, active, onClick, currentUserId, unreadCount, onDelete }: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const isSwiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentOffset.current = offsetX;
    isSwiping.current = false;
    isHorizontal.current = null;
  }, [offsetX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    e.preventDefault();
    isSwiping.current = true;

    const newOffset = Math.max(-DELETE_WIDTH, Math.min(0, currentOffset.current + dx));
    setOffsetX(newOffset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;

    if (offsetX < -SWIPE_THRESHOLD) {
      setOffsetX(-DELETE_WIDTH);
    } else {
      setOffsetX(0);
    }
  }, [offsetX]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (offsetX !== 0) {
      setOffsetX(0);
      return;
    }
    startX.current = e.clientX;
    currentOffset.current = 0;
    isSwiping.current = false;
    isHorizontal.current = null;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;

      if (isHorizontal.current === null) {
        if (Math.abs(dx) > 5) {
          isHorizontal.current = true;
        }
        return;
      }

      if (!isHorizontal.current) return;

      isSwiping.current = true;
      const newOffset = Math.max(-DELETE_WIDTH, Math.min(0, dx));
      setOffsetX(newOffset);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!isSwiping.current) return;

      setOffsetX((prev) => {
        if (prev < -SWIPE_THRESHOLD) {
          return -DELETE_WIDTH;
        }
        return 0;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [offsetX]);

  const handleClick = useCallback(() => {
    if (isSwiping.current) {
      isSwiping.current = false;
      return;
    }
    if (offsetX !== 0) {
      setOffsetX(0);
      return;
    }
    onClick();
  }, [offsetX, onClick]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(conversation.id);
  }, [conversation.id, onDelete]);

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center bg-red-600 cursor-pointer"
        onClick={handleDelete}
      >
        <IconDeleteSwipe size={22} className="text-white" />
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none ${
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
    </div>
  );
}
