import React, { useRef, useCallback } from 'react';
import { Conversation, LastMessage } from '@biu/shared';
import { IconDeleteSwipe } from './Icons';
import UserBadge from './UserBadge';
import AvatarWithBadge from './AvatarWithBadge';
import { renderPreview } from '../utils/mention';

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  currentUserId: string;
  unreadCount: number;
  onDelete: (conversationId: string) => void;
  isOpened: boolean;
  onSwipeOpen: (conversationId: string) => void;
  onSwipeClose: () => void;
}

function formatUnread(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 72;

export default function ConversationItem({
  conversation,
  active,
  onClick,
  currentUserId,
  unreadCount,
  onDelete,
  isOpened,
  onSwipeOpen,
  onSwipeClose,
}: Props) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const dragOffset = useRef(0);

  const otherMember = conversation.type === 'private'
    ? conversation.members.find((m) => m.userId !== currentUserId)
    : null;

  const isSystemConv = !!otherMember?.user?.isSystem;

  const displayName =
    conversation.type === 'group'
      ? conversation.name
      : isSystemConv
        ? 'Biu团队'
        : otherMember?.user?.nickname || '未知用户';

  const avatarFallback = isSystemConv
    ? '🔔'
    : conversation.type === 'group'
      ? conversation.name?.[0] || '群'
      : otherMember?.user?.nickname?.[0] || '?';

  const systemBadges = isSystemConv
    ? [{ type: 'SYSTEM', label: '系统', icon: 'bell', color: '#3B82F6', description: '系统通知' }]
    : [];

  const otherBadges = otherMember?.user ? otherMember.user.badges : undefined;

  const lastMsg = conversation.lastMessage as LastMessage | null | undefined;
  const isSelf = lastMsg?.senderId === currentUserId;

  let preview = '暂无消息';
  if (lastMsg) {
    const formattedContent = renderPreview(lastMsg.content);
    if (isSelf) {
      if (conversation.type === 'group') {
        preview = `你: ${formattedContent}`;
      } else {
        preview = formattedContent;
      }
    } else {
      const senderName = lastMsg.senderNickname || '对方';
      preview = `${senderName}: ${formattedContent}`;
    }
  }

  // 添加 @ 提示前缀
  if (conversation.mentionType && unreadCount > 0) {
    if (conversation.mentionType === 'all') {
      preview = `@全体成员 ${preview}`;
    } else if (conversation.mentionType === 'me') {
      preview = `@我 ${preview}`;
    }
  }

  const badge = formatUnread(unreadCount);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragOffset.current = 0;
    isSwiping.current = false;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
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

      const base = isOpened ? -DELETE_WIDTH : 0;
      const newOffset = Math.max(-DELETE_WIDTH, Math.min(0, base + dx));
      dragOffset.current = newOffset;
    },
    [isOpened]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;

    if (dragOffset.current < -SWIPE_THRESHOLD) {
      onSwipeOpen(conversation.id);
    } else {
      onSwipeClose();
    }
  }, [conversation.id, onSwipeOpen, onSwipeClose]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isOpened) {
        onSwipeClose();
        return;
      }
      startX.current = e.clientX;
      dragOffset.current = 0;
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
        dragOffset.current = newOffset;
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (!isSwiping.current) return;

        if (dragOffset.current < -SWIPE_THRESHOLD) {
          onSwipeOpen(conversation.id);
        } else {
          onSwipeClose();
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isOpened, conversation.id, onSwipeOpen, onSwipeClose]
  );

  const handleClick = useCallback(() => {
    if (isSwiping.current) {
      isSwiping.current = false;
      return;
    }
    if (isOpened) {
      onSwipeClose();
      return;
    }
    onClick();
  }, [isOpened, onSwipeClose, onClick]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(conversation.id);
    },
    [conversation.id, onDelete]
  );

  const canDelete = !isSystemConv;

  const translateX = isOpened ? -DELETE_WIDTH : 0;

  return (
    <div className="relative overflow-hidden">
      {canDelete && (
        <div
          className="absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center bg-red-600 cursor-pointer"
          onClick={handleDelete}
        >
          <IconDeleteSwipe size={22} className="text-white" />
        </div>
      )}
      <div
        onTouchStart={canDelete ? handleTouchStart : undefined}
        onTouchMove={canDelete ? handleTouchMove : undefined}
        onTouchEnd={canDelete ? handleTouchEnd : undefined}
        onMouseDown={canDelete ? handleMouseDown : undefined}
        onClick={handleClick}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`relative flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none bg-biu-dark ${
          active
            ? 'border-l-2 border-biu-primary'
            : 'hover:bg-biu-dark-alt border-l-2 border-transparent'
        }`}
      >
        {active && <div className="absolute inset-0 bg-biu-primary/10 pointer-events-none" />}
        <div className="relative shrink-0">
          <AvatarWithBadge
            fallback={avatarFallback}
            isSystem={isSystemConv}
            badges={isSystemConv ? systemBadges : otherBadges}
            size="md"
          />
          {badge && (
            <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-biu-accent text-white text-[10px] font-display font-600 flex items-center justify-center leading-none">
              {badge}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <span className="text-white text-sm font-medium font-display truncate">{displayName}</span>
            {isSystemConv && <UserBadge badges={systemBadges} size="sm" />}
          </div>
          <p className={`text-xs truncate mt-0.5 font-body ${
            conversation.mentionType && unreadCount > 0 
              ? 'text-red-400' 
              : 'text-gray-500'
          }`}>{preview}</p>
        </div>
      </div>
    </div>
  );
}
