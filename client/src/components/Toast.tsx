import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 250);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles: Record<string, { bg: string; border: string; icon: string }> = {
    error: {
      bg: 'bg-red-500/15',
      border: 'border-red-500/25',
      icon: 'text-red-400',
    },
    success: {
      bg: 'bg-biu-primary/15',
      border: 'border-biu-primary/25',
      icon: 'text-biu-primary',
    },
    info: {
      bg: 'bg-white/8',
      border: 'border-white/12',
      icon: 'text-gray-400',
    },
  };

  const s = styles[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl ${s.bg} border ${s.border} backdrop-blur-xl text-white text-sm font-body flex items-center gap-2.5 ${
        exiting ? 'animate-toast-exit' : 'animate-toast-enter'
      }`}
    >
      {type === 'success' && (
        <svg className={`w-4 h-4 ${s.icon} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {type === 'error' && (
        <svg className={`w-4 h-4 ${s.icon} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
}
