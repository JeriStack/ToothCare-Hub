import { LogLevel } from '../utils/logger';

export interface RealtimeEnvironment {
  nodeEnv: string;
  port: number;
  host: string;
  allowedOrigins: string[];
  backendInternalApiUrl: string;
  internalSecret: string;
  socketPath: string;
  replayWindowSeconds: number;
  sessionRevalidateIntervalMs: number;
  publishRateLimitPerMin: number;
  maxConnectionsPerUser: number;
  eventDedupTtlMs: number;
  eventDedupMaxSize: number;
  logLevel: LogLevel;
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

export function loadEnvironment(env: NodeJS.ProcessEnv = process.env): RealtimeEnvironment {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const port = parsePositiveInt(env.PORT, 4000, 0, 65535);
  const host = (env.HOST || '0.0.0.0').trim();

  const rawOrigins = (
    env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (rawOrigins.includes('*')) {
    throw new Error('ALLOWED_ORIGINS must not contain wildcard "*". Explicit origins are required.');
  }

  const backendInternalApiUrl = (env.BACKEND_INTERNAL_API_URL || 'http://nginx:8081').trim().replace(/\/+$/, '');
  const internalSecret = (env.REALTIME_INTERNAL_SECRET || '').trim();

  if (nodeEnv === 'production' && internalSecret.length < 32) {
    throw new Error('REALTIME_INTERNAL_SECRET must be at least 32 characters in production.');
  }

  if (nodeEnv !== 'test' && internalSecret.length === 0) {
    throw new Error('REALTIME_INTERNAL_SECRET is required at startup.');
  }

  const socketPath = '/' + (env.SOCKET_PATH || '/socket.io/').replace(/^\/+|\/+$/g, '') + '/';
  const rawLevel = (env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info')).toLowerCase() as LogLevel;
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
  const logLevel: LogLevel = validLevels.includes(rawLevel) ? rawLevel : 'info';

  return {
    nodeEnv,
    port,
    host,
    allowedOrigins: rawOrigins,
    backendInternalApiUrl,
    internalSecret,
    socketPath,
    replayWindowSeconds: parsePositiveInt(env.REPLAY_WINDOW_SECONDS, 300, 30, 600),
    sessionRevalidateIntervalMs: parsePositiveInt(env.SESSION_REVALIDATE_INTERVAL_MS, 60000, 5000, 600000),
    publishRateLimitPerMin: parsePositiveInt(env.PUBLISH_RATE_LIMIT_PER_MIN, 600, 10, 100000),
    maxConnectionsPerUser: parsePositiveInt(env.MAX_CONNECTIONS_PER_USER, 10, 1, 100),
    eventDedupTtlMs: parsePositiveInt(env.EVENT_DEDUP_TTL_MS, 300000, 10000, 3600000),
    eventDedupMaxSize: parsePositiveInt(env.EVENT_DEDUP_MAX_SIZE, 10000, 100, 200000),
    logLevel,
  };
}
