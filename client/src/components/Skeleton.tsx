import React from 'react';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

export function ConversationSkeleton() {
  return (
    <div className="px-3 py-3 flex items-center gap-3">
      <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}

export function MessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex gap-2.5 mb-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
      <div className={`space-y-2 ${isOwn ? 'items-end' : ''}`}>
        <Skeleton className={`h-3.5 ${isOwn ? 'w-24 ml-auto' : 'w-28'}`} />
        <Skeleton className={`h-3.5 ${isOwn ? 'w-16 ml-auto' : 'w-20'}`} />
      </div>
    </div>
  );
}
