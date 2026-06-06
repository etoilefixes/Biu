import React from 'react';
import { IconCheck, IconX, IconAlertCircle } from './Icons';

interface LocalToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function LocalToast({ message, type, onClose }: LocalToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const iconMap: Record<string, React.ReactNode> = {
    success: <IconCheck size={14} />,
    error: <IconX size={14} />,
    info: <IconAlertCircle size={14} />,
  };

  const colorMap: Record<string, string> = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    error: 'text-biu-accent bg-biu-accent/10 border-biu-accent/20',
    info: 'text-biu-primary bg-biu-primary/10 border-biu-primary/20',
  };

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-auto animate-fade-in">
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-2xl shadow-2xl font-body text-xs ${colorMap[type]}`}>
        <span className="shrink-0">{iconMap[type]}</span>
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition">
          <IconX size={12} />
        </button>
      </div>
    </div>
  );
}
