import React from 'react';
import { Badge } from '@biu/shared';
import officialSvg from '../assets/badges/official.svg';
import verifiedSvg from '../assets/badges/verified.svg';
import aiSvg from '../assets/badges/AI.svg';
import botSvg from '../assets/badges/bot.svg';
import systemSvg from '../assets/badges/system.svg';
import notificationSvg from '../assets/badges/notification.svg';

interface Props {
  badges?: Badge[];
  size?: 'sm' | 'md';
}

const BADGE_SVG: Record<string, string> = {
  OFFICIAL: officialSvg,
  VERIFIED: verifiedSvg,
  AI: aiSvg,
  BOT: botSvg,
  SYSTEM: systemSvg,
  NOTIFICATION: notificationSvg,
};

export default function UserBadge({ badges, size = 'sm' }: Props) {
  if (!badges || badges.length === 0) return null;

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((badge) => (
        <img
          key={badge.type}
          src={BADGE_SVG[badge.type] || notificationSvg}
          alt={badge.type}
          width={iconSize}
          height={iconSize}
        />
      ))}
    </span>
  );
}
