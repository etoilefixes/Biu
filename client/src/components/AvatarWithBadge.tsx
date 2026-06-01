import React from 'react';
import { Badge } from '@biu/shared';

interface Props {
  src?: string | null;
  fallback: string;
  isSystem?: boolean;
  badges?: Badge[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_ICON: Record<string, string> = {
  OFFICIAL: '🛡',
  AI: '⚡',
  SYSTEM: '🔔',
  VERIFIED: '✓',
  BOT: '🤖',
  ENTERPRISE: '🏢',
};

const BADGE_BG: Record<string, string> = {
  OFFICIAL: 'bg-emerald-500',
  AI: 'bg-violet-500',
  SYSTEM: 'bg-blue-500',
  VERIFIED: 'bg-emerald-500',
  BOT: 'bg-amber-500',
  ENTERPRISE: 'bg-indigo-500',
};

const SIZE_MAP = {
  sm: { avatar: 'w-8 h-8 text-xs', badge: 'w-3.5 h-3.5 text-[7px] -bottom-0.5 -right-0.5' },
  md: { avatar: 'w-10 h-10 text-sm', badge: 'w-4 h-4 text-[8px] -bottom-0.5 -right-0.5' },
  lg: { avatar: 'w-12 h-12 text-base', badge: 'w-5 h-5 text-[9px] -bottom-0.5 -right-0.5' },
};

export default function AvatarWithBadge({ src, fallback, isSystem, badges, size = 'md', className = '' }: Props) {
  const primaryBadge = badges && badges.length > 0 ? badges[0] : null;
  const s = SIZE_MAP[size];

  const avatarContent = src ? (
    <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
  ) : (
    fallback
  );

  const bgClass = isSystem
    ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
    : src
      ? ''
      : 'bg-gradient-to-br from-biu-secondary/30 to-biu-secondary/10';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${s.avatar} rounded-xl flex items-center justify-center text-white font-display font-600 ${bgClass}`}>
        {avatarContent}
      </div>
      {primaryBadge && (
        <span className={`absolute ${s.badge} rounded-full ${BADGE_BG[primaryBadge.type] || 'bg-gray-500'} flex items-center justify-center ring-2 ring-biu-dark`}>
          {BADGE_ICON[primaryBadge.type] || '✓'}
        </span>
      )}
    </div>
  );
}
