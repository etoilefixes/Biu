import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@biu/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Markdown 渲染（较大，独立拆分）
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          // Emoji 选择器（~500KB，独立拆分）
          'vendor-emoji': ['emoji-mart', '@emoji-mart/data', '@emoji-mart/react'],
          // 动画库
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    // 启用 gzip 压缩提示
    reportCompressedSize: true,
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
  },
});
