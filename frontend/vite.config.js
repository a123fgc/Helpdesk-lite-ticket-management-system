import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read only VITE_-prefixed values from .env / .env.[mode].
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Where the DEV SERVER forwards /api. Irrelevant in production: a built
  // bundle never runs this config, it just calls VITE_API_BASE_URL directly.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': proxyTarget,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
