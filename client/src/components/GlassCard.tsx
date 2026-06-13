import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', strong = false, hover = false }: GlassCardProps) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass'} rounded-2xl transition-all duration-300 ${
      hover
        ? 'hover:border-white/[0.14] hover:shadow-surface-lg hover:-translate-y-0.5 cursor-pointer'
        : 'hover:border-white/[0.12] hover:shadow-surface'
    } ${className}`}>
      {children}
    </div>
  );
}
