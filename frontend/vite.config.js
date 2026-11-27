import http from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BENIGN_WS_PROXY_ERRORS = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE']);
const BENIGN_HTTP_CLIENT_ABORT_ERRORS = new Set(['ECONNABORTED', 'EPIPE']);
const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080';

// Disable upstream keep-alive pooling for the dev HTTP proxy so Node 20+/24's default
// keepAlive globalAgent does not reuse stale sockets dropped by Docker Desktop / wslrelay.exe
// (which causes intermittent `Error: read ECONNRESET` on `/api/*` requests after brief idleness).
const apiProxyAgent = new http.Agent({ keepAlive: false });

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        agent: apiProxyAgent,
        headers: {
          Connection: 'close',
        },
        timeout: 30000,
        proxyTimeout: 30000,
        configure(proxy) {
          proxy.on('error', (err, req, res) => {
            if (req?.destroyed || BENIGN_HTTP_CLIENT_ABORT_ERRORS.has(err?.code)) {
              return;
            }
            console.error(`[vite] api proxy error (${req?.url || 'unknown'}):`, err?.code || err?.message || err);
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  data: null,
                  error: {
                    code: 'UPSTREAM_UNAVAILABLE',
                    message: 'Unable to reach the backend API server. Please ensure Docker services are running.',
                  },
                })
              );
            }
          });
        },
      },
      '/socket.io': {
        target: API_PROXY_TARGET,
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
