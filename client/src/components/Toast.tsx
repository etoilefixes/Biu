import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles: Record<string, string> = {
    error: 'bg-biu-accent/90 shadow-glow-accent',
    success: 'bg-biu-primary/90 shadow-glow',
    info: 'bg-biu-secondary/90',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-5 py-2.5 rounded-xl ${styles[type]} backdrop-blur-md text-white text-sm font-body transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {message}
    </div>
  );
}
