import { ServerOptions } from 'socket.io';
import { RealtimeEnvironment } from './environment';

/**
 * Builds hardened Socket.IO server options.
 * - Explicit CORS allowlist only (never "*")
 * - WebSocket transport with HTTP long-polling fallback
 * - Bounded maxHttpBufferSize to prevent memory exhaustion
 */
export function buildSocketServerOptions(env: RealtimeEnvironment): Partial<ServerOptions> {
  return {
    path: env.socketPath,
    transports: ['websocket', 'polling'],
    cors: {
      origin: (origin, callback) => {
        // Allow server-to-server or same-origin requests without Origin header (e.g. health checks / tests)
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by realtime CORS policy'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
    maxHttpBufferSize: 16 * 1024, // 16 KB max client packet size
    allowUpgrades: true,
    serveClient: false,
  };
}
