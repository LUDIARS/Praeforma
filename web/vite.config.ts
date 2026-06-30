import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ludiarsHosts = (process.env.LUDIARS_ALLOWED_HOSTS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    ...(ludiarsHosts.length > 0 ? { allowedHosts: ludiarsHosts } : {}),
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
