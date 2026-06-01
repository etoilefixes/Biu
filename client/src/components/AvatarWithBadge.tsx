import React from 'react';
import { Badge } from '@biu/shared';
import officialSvg from '../assets/badges/official.svg';
import verifiedSvg from '../assets/badges/verified.svg';
import aiSvg from '../assets/badges/AI.svg';
import botSvg from '../assets/badges/bot.svg';
import systemSvg from '../assets/badges/system.svg';
import notificationSvg from '../assets/badges/notification.svg';

interface Props {
  src?: string | null;
  fallback: string;
  isSystem?: boolean;
  badges?: Badge[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_SVG: Record<string, string> = {
  OFFICIAL: officialSvg,
  VERIFIED: verifiedSvg,
  AI: aiSvg,
  BOT: botSvg,
  SYSTEM: systemSvg,
  NOTIFICATION: notificationSvg,
};

const SIZE_MAP = {
  sm: { avatar: 'w-8 h-8 text-xs', badge: '-bottom-0.5 -right-0.5', img: 14 },
  md: { avatar: 'w-10 h-10 text-sm', badge: '-bottom-0.5 -right-0.5', img: 16 },
  lg: { avatar: 'w-12 h-12 text-base', badge: '-bottom-1 -right-1', img: 18 },
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
    ? ''
    : src
      ? ''
      : 'bg-gradient-to-br from-biu-primary/25 to-biu-primary/8';

  return (
    <div className={`relative shrink-0 ${className}`}>
      {isSystem ? (
        <div className={`${s.avatar} rounded-xl flex items-center justify-center overflow-hidden`}>
          <img src={systemSvg} alt="系统" className="w-full h-full" />
        </div>
      ) : (
        <div className={`${s.avatar} rounded-xl flex items-center justify-center text-white font-display font-600 ${bgClass}`}>
          {avatarContent}
        </div>
      )}
      {primaryBadge && (
        <span className={`absolute ${s.badge} rounded-full flex items-center justify-center ring-2 ring-biu-dark overflow-hidden`}>
          <img
            src={BADGE_SVG[primaryBadge.type] || notificationSvg}
            alt={primaryBadge.type}
            width={s.img}
            height={s.img}
          />
        </span>
      )}
    </div>
  );
}
