import React, { useEffect, useRef } from 'react';
import { IconX } from './Icons';

interface GlassConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GlassConfirm({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: GlassConfirmProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => confirmBtnRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-overlay-in">
      <div
        className="glass-strong rounded-2xl p-6 w-80 shadow-surface-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-display font-600 text-sm">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition"
          >
            <IconX size={16} />
          </button>
        </div>

        <p className="text-gray-400 text-sm font-body leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm font-body"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-body font-500 transition ${
              danger
                ? 'bg-biu-accent/10 text-biu-accent hover:bg-biu-accent/20'
                : 'bg-biu-primary text-biu-dark hover:bg-biu-primary-dim'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
