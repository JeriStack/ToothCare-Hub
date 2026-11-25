import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BENIGN_WS_PROXY_ERRORS = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE']);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true,
        configure(proxy) {
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if (!BENIGN_WS_PROXY_ERRORS.has(err?.code)) {
                console.error('[vite] ws client socket error:', err);
              }
            });
          });
          proxy.on('error', (err) => {
            if (!BENIGN_WS_PROXY_ERRORS.has(err?.code)) {
              console.error('[vite] ws proxy error:', err);
            }
          });
        }
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
        },
      }
    }
  }
});
