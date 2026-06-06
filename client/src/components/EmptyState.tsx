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
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-gray-600 mb-5">
        {icon}
      </div>
      <h3 className="text-gray-400 font-display font-500 text-sm mb-1.5">{title}</h3>
      {description && (
        <p className="text-gray-600 text-xs font-body leading-relaxed max-w-[240px]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
