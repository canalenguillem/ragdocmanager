import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        rewrite: (apiPath) => apiPath.replace(/^\/api/, '')
      },
      '/auth': 'http://backend:4000',
      '/documents': 'http://backend:4000',
      '/query': 'http://backend:4000',
      '/settings': 'http://backend:4000',
      '/health': 'http://backend:4000'
    }
  }
});
