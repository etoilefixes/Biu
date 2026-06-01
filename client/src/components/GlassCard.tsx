import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}

export default function GlassCard({ children, className = '', strong = false }: GlassCardProps) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass'} rounded-2xl transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_4px_24px_rgba(0,0,0,0.2)] ${className}`}>
      {children}
    </div>
  );
}
