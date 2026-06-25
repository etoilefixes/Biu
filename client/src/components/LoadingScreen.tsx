import React from 'react';

/** 品牌加载页 — Biu Logo + shimmer 动画，替代简陋的 Suspense fallback */
export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-biu-dark">
      <div className="flex flex-col items-center gap-6">
        {/* Biu Logo */}
        <div className="relative">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-glow"
          >
            <rect width="48" height="48" rx="14" fill="rgba(0, 212, 170, 0.12)" />
            <path
              d="M14 24C14 18.477 18.477 14 24 14C29.523 14 34 18.477 34 24C34 29.523 29.523 34 24 34"
              stroke="#00D4AA"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="origin-center"
              style={{ animation: 'spin 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite' }}
            />
          </svg>
        </div>

        {/* 品牌名 */}
        <span className="text-biu-primary font-display font-600 text-lg tracking-wider">
          Biu
        </span>

        {/* Shimmer 进度条 */}
        <div className="w-36 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-transparent via-biu-primary to-transparent"
            style={{ animation: 'shimmer 1.8s ease-in-out infinite', width: '60%' }}
          />
        </div>
      </div>
    </div>
  );
}
