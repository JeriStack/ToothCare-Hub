import { ServerOptions } from 'socket.io';
import { RealtimeEnvironment } from './environment';

const PRIVATE_172_HOST_PATTERN = /^172\.(1[6-9]|2[0-9]|3[0-1])\./;

/**
 * Determine whether a browser Origin header is permitted to establish a Socket.IO connection.
 * - Always allows explicit origins configured in `ALLOWED_ORIGINS`.
 * - In `development` only (mirroring backend `CorsMiddleware.php`), also permits loopback
 *   and RFC1918 private LAN origins so Vite dev sessions accessed from LAN/mobile devices work.
 * - In `production`, strictly enforces the explicit allowlist only.
 */
export function isAllowedRealtimeOrigin(origin: string, env: RealtimeEnvironment): boolean {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const allowedList = env.allowedOrigins.map((allowed) => allowed.replace(/\/+$/, ''));

  if (allowedList.includes(normalizedOrigin)) {
    return true;
  }

  if (env.nodeEnv !== 'development') {
    return false;
  }

  try {
    const parsed = new URL(normalizedOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      PRIVATE_172_HOST_PATTERN.test(host)
    );
  } catch {
    return false;
  }
}

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
        if (isAllowedRealtimeOrigin(origin, env)) {
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
