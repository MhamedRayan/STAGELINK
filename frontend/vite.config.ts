import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/svc/identity': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svc\/identity/, ''),
      },
      '/svc/offers': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svc\/offers/, ''),
      },
      '/svc/applications': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svc\/applications/, ''),
      },
      '/svc/internships': {
        target: 'http://localhost:8004',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svc\/internships/, ''),
      },
      '/svc/notifications': {
        target: 'http://localhost:8005',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svc\/notifications/, ''),
      },
    },
  },
});
