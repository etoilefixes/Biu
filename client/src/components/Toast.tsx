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

  const bgColor = {
    error: 'bg-red-500/80',
    success: 'bg-green-500/80',
    info: 'bg-biu-primary/80',
  }[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg ${bgColor} backdrop-blur-md text-white text-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
