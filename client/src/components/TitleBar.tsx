import React, { useState, useEffect } from 'react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI?.isMaximized().then(setIsMaximized);
    window.electronAPI?.onMaximizedChanged(setIsMaximized);
  }, []);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className="flex items-center justify-end h-9 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors duration-150"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors duration-150"
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
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-biu-accent transition-colors duration-150"
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
