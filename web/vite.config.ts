import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      // backend を直叩きすると CORS preflight が増えるので /api を vite が proxy する
      '/api': {
        target: 'http://localhost:8889',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8889',
        ws: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
