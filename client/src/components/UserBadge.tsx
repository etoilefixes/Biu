import React from 'react';
import { Badge } from '@biu/shared';

interface Props {
  badges?: Badge[];
  size?: 'sm' | 'md';
}

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  OFFICIAL: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  AI: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  SYSTEM: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  VERIFIED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  BOT: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  ENTERPRISE: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
};

export default function UserBadge({ badges, size = 'sm' }: Props) {
  if (!badges || badges.length === 0) return null;

  const px = size === 'sm' ? 'px-1.5' : 'px-2';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((badge) => {
        const style = BADGE_STYLES[badge.type] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
        return (
          <span
            key={badge.type}
            className={`${px} ${py} rounded-md ${style.bg} ${style.text} ${textSize} font-display font-600 inline-flex items-center gap-0.5`}
          >
            {badge.icon === 'shield' && '🛡'}
            {badge.icon === 'cpu' && '⚡'}
            {badge.icon === 'bell' && '🔔'}
            {badge.icon === 'check-circle' && '✓'}
            {badge.icon === 'bot' && '🤖'}
            {badge.icon === 'building' && '🏢'}
            {badge.label}
          </span>
        );
      })}
    </span>
  );
}
