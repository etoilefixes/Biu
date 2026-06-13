import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const totalUnread = useChatStore((s) => s.totalUnread);

  useEffect(() => {
    window.electronAPI?.isMaximized().then(setIsMaximized);
    window.electronAPI?.onMaximizedChanged(setIsMaximized);
  }, []);

  useEffect(() => {
    const unsubscribe = socketService.onConnectionChange(setIsConnected);
    return unsubscribe;
  }, []);

  // 同步角标到 Electron
  useEffect(() => {
    if (window.electronAPI?.setBadge) {
      window.electronAPI.setBadge(totalUnread);
    }
  }, [totalUnread]);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className="flex items-center justify-between h-9 shrink-0 select-none px-3 border-b border-white/[0.03]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-1.5 min-w-0">
        {!isConnected && (
          <span className="flex items-center gap-1 text-amber-400 text-xs font-body animate-pulse">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3v3" strokeLinecap="round" />
              <circle cx="6" cy="8.5" r="0.75" fill="currentColor" stroke="none" />
              <rect x="1" y="1" width="10" height="10" rx="2" />
            </svg>
            无网络连接
          </span>
        )}
        {isConnected && (
          <span className="text-gray-600 text-xs font-body truncate">
            {totalUnread > 0 ? `${totalUnread} 条未读消息` : 'Biu'}
          </span>
        )}
      </div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/[0.06] transition-colors duration-150"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/[0.06] transition-colors duration-150"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" rx="0.5" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-biu-accent transition-colors duration-150"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
