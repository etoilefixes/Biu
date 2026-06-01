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

const BADGE_BG: Record<string, string> = {
  OFFICIAL: 'bg-blue-700',
  AI: 'bg-amber-500',
  SYSTEM: 'bg-blue-500',
  VERIFIED: 'bg-blue-700',
  BOT: 'bg-amber-500',
  ENTERPRISE: 'bg-indigo-500',
};

const BADGE_FILL: Record<string, string> = {
  OFFICIAL: '#1d4ed8',
  AI: '#f59e0b',
  SYSTEM: '#3b82f6',
  VERIFIED: '#1d4ed8',
  BOT: '#f59e0b',
  ENTERPRISE: '#6366f1',
};

const SIZE_MAP = {
  sm: { avatar: 'w-8 h-8 text-xs', badge: '-bottom-0.5 -right-0.5', svg: 14 },
  md: { avatar: 'w-10 h-10 text-sm', badge: '-bottom-0.5 -right-0.5', svg: 16 },
  lg: { avatar: 'w-12 h-12 text-base', badge: '-bottom-1 -right-1', svg: 18 },
};

function BadgeIcon({ type, fill, size }: { type: string; fill: string; size: number }) {
  const OFFICIAL_PATH = 'M921.569608 320.364425c-50.833759-108.726284-140.957359-191.143365-253.80245-232.086869-112.863511-40.924061-234.838539-35.475979-343.584266 15.375175-19.437701 9.092076-27.826765 32.231075-18.73469 51.687197 9.111518 19.456121 32.268938 27.826765 51.686173 18.734689 89.878007-42.044582 190.802604-46.561455 284.115849-12.69923 93.313246 33.843806 167.853939 102.007255 209.897498 191.922101 86.784552 185.581696 6.396687 407.211399-179.185009 494.013347-90.143043 42.119283-191.238532 46.599318-284.760532 12.603039-93.160773-33.901111-167.492712-102.007255-209.251791-191.751208-52.826136-113.51024-53.679573-222.995817-2.315742-292.884561 24.694425-33.598212 59.392692-52.768831 88.073918-48.972364 25.946952 3.454682 39.61423 25.435299 46.50415 43.258223 0.057305 0.170892 0.170892 0.303922 0.228197 0.455371 0.075725 0.208754 0.113587 0.417509 0.190335 0.60682l165.480892 393.050888a38.938847 38.938847 0 0 0 35.628452 23.783683h0.207731c15.470343 0 29.497824-9.188266 35.666314-23.385617l170.662915-393.050887c8.541537-19.702738-0.493234-42.595121-20.178575-51.155077-19.7406-8.523117-42.574654 0.512676-51.154054 20.177551L512.497838 649.712455 382.304637 340.446809c-0.095167-0.246617-0.26606-0.435928-0.379646-0.682545-20.348444-51.059909-59.564607-84.069721-107.947548-90.52269-57.476039-7.611352-119.090329 23.00597-160.982438 79.988776-68.447928 93.104491-70.517053 232.067426-5.543249 371.734396 50.547233 108.612697 140.463102 191.011358 253.175163 232.012168 50.187029 18.259876 102.178147 27.351951 154.035212 27.351951 64.934918 0 129.642662-14.255679 190.231599-42.59512 224.419236-104.969727 321.625138-372.951107 216.675878-597.36932z';
  if (type === 'OFFICIAL' || type === 'VERIFIED') {
    return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d={OFFICIAL_PATH} /></svg>;
  }
  if (type === 'AI') {
    return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" /><path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" /></svg>;
  }
  if (type === 'SYSTEM') {
    return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d="M512 64c181.1 0 328 146.9 328 328 0 121.3-66 227.2-164 283.4V760c0 22.1-17.9 40-40 40H388c-22.1 0-40-17.9-40-40V675.4C250 619.2 184 513.3 184 392c0-181.1 146.9-328 328-328zm76 736H436v32c0 22.1 17.9 40 40 40h72c22.1 0 40-17.9 40-40v-32zM512 140c-139.2 0-252 112.8-252 252 0 100.5 58.8 187.3 144 228.3V700h216V620.3c85.2-41 144-127.8 144-228.3 0-139.2-112.8-252-252-252z" /></svg>;
  }
  if (type === 'BOT') {
    return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d="M512 128c-212.1 0-384 171.9-384 384v192c0 35.3 28.7 64 64 64h640c35.3 0 64-28.7 64-64V512c0-212.1-171.9-384-384-384zM300 576c-33.1 0-60-26.9-60-60s26.9-60 60-60 60 26.9 60 60-26.9 60-60 60zm424 0c-33.1 0-60-26.9-60-60s26.9-60 60-60 60 26.9 60 60-26.9 60-60 60zM512 192c176.7 0 320 143.3 320 320H192c0-176.7 143.3-320 320-320zM384 832h256c0 35.3-28.7 64-64 64H448c-35.3 0-64-28.7-64-64z" /></svg>;
  }
  if (type === 'ENTERPRISE') {
    return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zm-40 728H184V184h656v656z" /><path d="M492 400h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm0 128h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm0 128h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm-160-256h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm320 0h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm-320 128h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm320 0h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm-160 128h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm-160 0h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zm320 0h40c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8h-40c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8zM340 336h344c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H340c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8z" /></svg>;
  }
  return <svg viewBox="0 0 1024 1024" width={size} height={size} fill={fill}><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7L465.4 605.8c-6.3 6.3-16.4 6.3-22.7 0L318.5 481.6c-6.3-6.3-6.3-16.4 0-22.7l22.7-22.7c6.3-6.3 16.4-6.3 22.7 0l79.3 79.3 216.9-216.9c6.3-6.3 16.4-6.3 22.7 0l22.7 22.7c6.3 6.4 6.3 16.4 0 22.7z" /></svg>;
}

export default function AvatarWithBadge({ src, fallback, isSystem, badges, size = 'md', className = '' }: Props) {
  const primaryBadge = badges && badges.length > 0 ? badges[0] : null;
  const s = SIZE_MAP[size];

  const avatarContent = src ? (
    <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
  ) : (
    fallback
  );

  const bgClass = isSystem
    ? 'bg-gradient-to-br from-biu-primary/60 to-biu-primary/30'
    : src
      ? ''
      : 'bg-gradient-to-br from-biu-primary/25 to-biu-primary/8';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${s.avatar} rounded-xl flex items-center justify-center text-white font-display font-600 ${bgClass}`}>
        {avatarContent}
      </div>
      {primaryBadge && (
        <span className={`absolute ${s.badge} rounded-full ${BADGE_BG[primaryBadge.type] || 'bg-gray-500'} flex items-center justify-center ring-2 ring-biu-dark`}>
          <BadgeIcon type={primaryBadge.type} fill={BADGE_FILL[primaryBadge.type] || '#6b7280'} size={s.svg} />
        </span>
      )}
    </div>
  );
}
