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
});
