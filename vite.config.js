import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import circleHandler from './api/circle.js';

const circleApiPlugin = {
  name: 'circle-api-dev',
  configureServer(server) {
    mountCircleHandler(server);
  },
  configurePreviewServer(server) {
    mountCircleHandler(server);
  },
};

function mountCircleHandler(server) {
  server.middlewares.use('/api/circle', (req, res, next) => {
    Promise.resolve(circleHandler(req, res)).catch(next);
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!process.env.CIRCLE_API_KEY && env.CIRCLE_API_KEY) {
    process.env.CIRCLE_API_KEY = env.CIRCLE_API_KEY;
  }

  return {
    plugins: [react(), circleApiPlugin],
    resolve: {
      alias: [
        {
          // Circle only uses jsonwebtoken.decode() for social-login nonce checks.
          // This app uses email OTP, so keep the Node crypto/stream decoder out of the browser bundle.
          find: /^jsonwebtoken$/,
          replacement: path.resolve(process.cwd(), 'src/shims/circle-social-jwt.js'),
        },
      ],
    },
    optimizeDeps: {
      include: ['react', 'react-dom/client', 'lucide-react', 'canvas-confetti', 'viem'],
    },
    build: {
      minify: false,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api/arc-agents': { target: 'https://nairatag.ng', changeOrigin: true, secure: true },
        '/api/arc-rewards': { target: 'https://nairatag.ng', changeOrigin: true, secure: true },
        '/api/arc-tasks': { target: 'https://nairatag.ng', changeOrigin: true, secure: true },
      },
    },
  };
});
