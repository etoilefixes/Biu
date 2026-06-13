import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-biu-primary/[0.04] border border-biu-primary/[0.08] flex items-center justify-center text-gray-500 mb-5 relative">
        {icon}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-biu-primary/[0.03] to-transparent pointer-events-none" />
      </div>
      <h3 className="text-gray-300 font-display font-500 text-sm mb-1.5">{title}</h3>
      {description && (
        <p className="text-gray-500 text-xs font-body leading-relaxed max-w-[260px]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
